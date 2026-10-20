import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  BarChart2,
  Sliders,
  Eye,
  EyeOff,
  RefreshCw,
  Compass,
  Zap,
  Activity,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MoveVertical,
} from 'lucide-react';
import { AssetBotState, AssetType } from '../types/bot';
import { CandlePoint, fetchLiveCandles } from '../utils/marketDataService';

interface MarketChartProps {
  botState: AssetBotState;
  onRefreshLiveSpot?: () => void;
}

export const MarketChart: React.FC<MarketChartProps> = ({ botState, onRefreshLiveSpot }) => {
  const {
    asset,
    ticker,
    spotPrice,
    strikePrice,
    realizedVol,
    earlyTriggerZ,
    timeRemainingSec,
    activeSignal,
  } = botState;

  const [chartType, setChartType] = useState<'area' | 'candle'>('area');
  const [showBands, setShowBands] = useState(true);
  const [showStrike, setShowStrike] = useState(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [isLoadingCandles, setIsLoadingCandles] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Drag-to-zoom feature: controls the vertical pixel spread between live spot and strike
  const [spreadZoom, setSpreadZoom] = useState<number>(1.0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartXRef = useRef<number | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragStartZoomRef = useRef<number>(1.0);
  const isDraggingRef = useRef<boolean>(false);
  const hasDraggedRef = useRef<boolean>(false);

  const priceDecimals = asset === 'XRP' ? 4 : asset === 'SOL' ? 3 : 2;

  // Load live candles from Coinbase Exchange whenever asset changes or user requests
  const loadCandles = async () => {
    setIsLoadingCandles(true);
    try {
      const data = await fetchLiveCandles(
        asset,
        strikePrice,
        realizedVol,
        earlyTriggerZ,
        timeRemainingSec,
        35
      );
      if (data && data.length > 0) {
        setCandles(data);
        setLastSyncTime(new Date().toLocaleTimeString());
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingCandles(false);
    }
  };

  useEffect(() => {
    loadCandles();
    const interval = setInterval(() => {
      loadCandles();
    }, 15000); // sync candles every 15s
    return () => clearInterval(interval);
  }, [asset, strikePrice]);

  // Global window listeners for drag-to-zoom so cursor can move freely anywhere without getting stuck
  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      if (dragStartYRef.current === null) return;

      const deltaY = dragStartYRef.current - clientY; // upward drag = positive (expand)
      const deltaX = dragStartXRef.current !== null ? clientX - dragStartXRef.current : 0; // rightward drag = positive (expand)
      const totalDelta = deltaY + deltaX * 0.5;

      if (Math.abs(totalDelta) > 2) {
        hasDraggedRef.current = true;
      }

      const zoomFactor = Math.pow(1.008, totalDelta);
      const nextZoom = Math.max(0.25, Math.min(10.0, dragStartZoomRef.current * zoomFactor));
      setSpreadZoom(Number(nextZoom.toFixed(2)));
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      dragStartYRef.current = null;
      dragStartXRef.current = null;
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);

    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };
  }, [isDragging]);

  // Update the latest candle in real-time with the current live spot price
  const activeCandles = useMemo(() => {
    if (candles.length === 0) return [];
    const copy = [...candles];
    const last = copy[copy.length - 1];
    if (last && Math.abs(last.close - spotPrice) > 0.00001) {
      copy[copy.length - 1] = {
        ...last,
        close: spotPrice,
        price: spotPrice,
        high: Math.max(last.high, spotPrice),
        low: Math.min(last.low, spotPrice),
      };
    }
    return copy;
  }, [candles, spotPrice]);

  // SVG dimensions
  const width = 800;
  const height = 300;
  const padding = { top: 25, right: 80, bottom: 35, left: 15 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Min / Max Price calculations with dynamic focal zoom
  const allPrices = activeCandles.flatMap((d) => [
    d.price,
    d.high,
    d.low,
    showStrike ? strikePrice : d.price,
    showBands && d.upperBand ? d.upperBand : d.price,
    showBands && d.lowerBand ? d.lowerBand : d.price,
  ]);

  const rawMin = allPrices.length > 0 ? Math.min(...allPrices) * 0.9994 : spotPrice * 0.99;
  const rawMax = allPrices.length > 0 ? Math.max(...allPrices) * 1.0006 : spotPrice * 1.01;

  // Focal center anchored between live spot and strike
  const focalCenter = (spotPrice + strikePrice) / 2;
  const rawHalfSpan = Math.max((rawMax - rawMin) / 2, Math.abs(spotPrice - strikePrice) * 1.25, spotPrice * 0.001);
  const effectiveHalfSpan = rawHalfSpan / spreadZoom;

  const minPrice = focalCenter - effectiveHalfSpan;
  const maxPrice = focalCenter + effectiveHalfSpan;
  const priceRange = maxPrice - minPrice || 1;

  const getX = (idx: number) => {
    if (activeCandles.length <= 1) return padding.left;
    return padding.left + (idx / (activeCandles.length - 1)) * innerWidth;
  };

  const getY = (val: number) => {
    return padding.top + innerHeight - ((val - minPrice) / priceRange) * innerHeight;
  };

  // Drag-to-zoom initiate handler
  const handleStartDrag = (clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    setIsDragging(true);
    dragStartYRef.current = clientY;
    dragStartXRef.current = clientX;
    dragStartZoomRef.current = spreadZoom;
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement | HTMLDivElement>) => {
    if (isDraggingRef.current) return;
    if (activeCandles.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left - (padding.left / width) * rect.width;
    const effectiveWidth = ((width - padding.left - padding.right) / width) * rect.width;
    const ratio = Math.max(0, Math.min(1, relX / effectiveWidth));
    const idx = Math.min(activeCandles.length - 1, Math.floor(ratio * activeCandles.length));
    setHoverIndex(idx);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setSpreadZoom((prev) => Math.max(0.25, Math.min(10.0, Number((prev * factor).toFixed(2)))));
  };

  // Build SVG path for Area chart
  const linePath = useMemo(() => {
    if (activeCandles.length < 2) return '';
    return activeCandles.reduce((path, d, idx) => {
      const x = getX(idx);
      const y = getY(d.price);
      return idx === 0 ? `M ${x} ${y}` : `${path} L ${x} ${y}`;
    }, '');
  }, [activeCandles, minPrice, maxPrice]);

  const areaPath = useMemo(() => {
    if (activeCandles.length < 2) return '';
    const firstX = getX(0);
    const lastX = getX(activeCandles.length - 1);
    const bottomY = padding.top + innerHeight;
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [linePath, activeCandles]);

  // Upper & Lower Band paths
  const upperBandPath = useMemo(() => {
    if (activeCandles.length < 2) return '';
    return activeCandles.reduce((path, d, idx) => {
      if (!d.upperBand) return path;
      const x = getX(idx);
      const y = getY(d.upperBand);
      return idx === 0 ? `M ${x} ${y}` : `${path} L ${x} ${y}`;
    }, '');
  }, [activeCandles, minPrice, maxPrice]);

  const lowerBandPath = useMemo(() => {
    if (activeCandles.length < 2) return '';
    return activeCandles.reduce((path, d, idx) => {
      if (!d.lowerBand) return path;
      const x = getX(idx);
      const y = getY(d.lowerBand);
      return idx === 0 ? `M ${x} ${y}` : `${path} L ${x} ${y}`;
    }, '');
  }, [activeCandles, minPrice, maxPrice]);

  const strikeY = getY(strikePrice);
  const spotY = getY(spotPrice);
  const isAboveStrike = spotPrice >= strikePrice;
  const hoveredPoint = hoverIndex !== null ? activeCandles[hoverIndex] : activeCandles[activeCandles.length - 1];

  const candleHigh = activeCandles.length > 0 ? Math.max(...activeCandles.map((c) => c.high)) : spotPrice;
  const candleLow = activeCandles.length > 0 ? Math.min(...activeCandles.map((c) => c.low)) : spotPrice;

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 sm:p-6 text-zinc-100 shadow-xl space-y-4">
      {/* Chart Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                {asset} 15M Live Volatility & Strike Chart
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Exchange Feed
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Synchronized with Coinbase Public APIs & Realized Volatility Barrier ({earlyTriggerZ.toFixed(2)}σ)
            </p>
          </div>
        </div>

        {/* View & Zoom Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Vertical Price-Strike Zoom Control Group */}
          <div className="flex items-center gap-1.5 bg-zinc-950 px-2 py-1 rounded-xl border border-zinc-800 text-xs font-mono">
            <span className="text-[10px] text-zinc-500 font-bold uppercase hidden sm:inline">
              Spacing:
            </span>
            <input
              type="range"
              min="0.25"
              max="8.0"
              step="0.05"
              value={spreadZoom}
              onChange={(e) => setSpreadZoom(parseFloat(e.target.value))}
              className="w-14 sm:w-20 accent-blue-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
              title="Drag slider to adjust space between price and strike"
            />
            <span className="text-[11px] text-blue-400 font-bold min-w-[36px] text-center">
              {spreadZoom.toFixed(1)}x
            </span>
            <div className="flex items-center gap-1 border-l border-zinc-800 pl-1.5">
              {[0.5, 1.0, 2.5, 5.0].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setSpreadZoom(preset)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    Math.abs(spreadZoom - preset) < 0.1
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                  title={`Set price-strike spacing to ${preset}x`}
                >
                  {preset}x
                </button>
              ))}
            </div>
            {spreadZoom !== 1.0 && (
              <button
                onClick={() => setSpreadZoom(1.0)}
                className="p-1 rounded hover:bg-zinc-800 text-amber-400 hover:text-amber-300 transition-colors ml-0.5"
                title="Reset zoom spacing to default 1.0x"
                aria-label="Reset zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={() => {
              loadCandles();
              onRefreshLiveSpot?.();
            }}
            disabled={isLoadingCandles}
            className="p-1.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
            title="Refresh Live Exchange Feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCandles ? 'animate-spin text-blue-400' : ''}`} />
            <span className="hidden sm:inline text-[11px]">Sync Live</span>
          </button>

          {/* Chart Type Toggle */}
          <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs">
            <button
              onClick={() => setChartType('area')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                chartType === 'area'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Area Line
            </button>
            <button
              onClick={() => setChartType('candle')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                chartType === 'candle'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Candles
            </button>
          </div>

          {/* Strike Toggle */}
          <button
            onClick={() => setShowStrike(!showStrike)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors flex items-center gap-1 ${
              showStrike
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                : 'bg-zinc-800/60 border-zinc-700 text-zinc-400'
            }`}
            title="Toggle Strike Reference Line"
          >
            <span>Strike</span>
          </button>

          {/* Volatility Bands Toggle */}
          <button
            onClick={() => setShowBands(!showBands)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors flex items-center gap-1 ${
              showBands
                ? 'bg-indigo-950/30 border-indigo-500/40 text-indigo-300'
                : 'bg-zinc-800/60 border-zinc-700 text-zinc-400'
            }`}
            title="Toggle ±1.00σ Volatility Envelope"
          >
            <span>Vol Bands</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas / SVG Container with Drag-to-Zoom */}
      <div
        onMouseDown={(e) => handleStartDrag(e.clientX, e.clientY)}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        onTouchStart={(e) => {
          if (e.touches.length === 1) {
            handleStartDrag(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        className={`relative w-full h-[300px] sm:h-[340px] bg-zinc-950/70 border border-zinc-800/80 rounded-xl overflow-hidden select-none transition-colors ${
          isDragging ? 'cursor-grabbing border-blue-500/60 shadow-inner' : 'cursor-grab hover:border-zinc-700'
        }`}
      >
        {/* Floating Zoom Active Notification / Hint */}
        {isDragging ? (
          <div className="absolute top-3 right-4 z-20 flex items-center gap-1.5 bg-blue-600/90 text-white text-xs font-mono px-3 py-1.5 rounded-xl shadow-xl backdrop-blur animate-pulse">
            <MoveVertical className="w-3.5 h-3.5" />
            <span>Spacing: {spreadZoom.toFixed(2)}x (Drag Up/Right = Expand • Down/Left = Shrink)</span>
          </div>
        ) : (
          <div className="absolute bottom-2 left-4 z-10 pointer-events-none flex items-center gap-1 text-[10px] text-zinc-500 font-mono bg-zinc-950/70 px-2 py-0.5 rounded border border-zinc-800/60">
            <MoveVertical className="w-3 h-3 text-zinc-400" />
            <span>Drag chart anywhere to expand/shrink space between price & strike</span>
          </div>
        )}

        {/* Hover Crosshair Legend Bar */}
        {hoveredPoint && !isDragging && (
          <div className="absolute top-3 left-4 z-10 flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono bg-zinc-900/95 border border-zinc-800 px-3 py-1.5 rounded-lg backdrop-blur shadow-lg">
            <span className="text-zinc-400">{hoveredPoint.timeStr}</span>
            <div>
              <span className="text-zinc-500 mr-1">SPOT:</span>
              <span className="text-white font-bold">${hoveredPoint.price.toFixed(priceDecimals)}</span>
            </div>
            <div>
              <span className="text-zinc-500 mr-1">STRIKE:</span>
              <span className="text-amber-400 font-bold">${strikePrice.toFixed(priceDecimals)}</span>
            </div>
            <div>
              <span className="text-zinc-500 mr-1">GAP:</span>
              <span className={hoveredPoint.price >= strikePrice ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {hoveredPoint.price >= strikePrice ? '+' : ''}$
                {(hoveredPoint.price - strikePrice).toFixed(priceDecimals)}
              </span>
            </div>
            {chartType === 'candle' && (
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-zinc-400">
                <span>O: ${hoveredPoint.open.toFixed(priceDecimals)}</span>
                <span>H: ${hoveredPoint.high.toFixed(priceDecimals)}</span>
                <span>L: ${hoveredPoint.low.toFixed(priceDecimals)}</span>
              </div>
            )}
          </div>
        )}

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full pointer-events-none"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Spot Gradient */}
            <linearGradient id="spotAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={isAboveStrike ? '#10b981' : '#f43f5e'}
                stopOpacity="0.30"
              />
              <stop
                offset="100%"
                stopColor={isAboveStrike ? '#10b981' : '#f43f5e'}
                stopOpacity="0.00"
              />
            </linearGradient>

            {/* Volatility Envelope Fill */}
            <linearGradient id="volBandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = padding.top + pct * innerHeight;
            const priceLevel = maxPrice - pct * priceRange;
            return (
              <g key={pct}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#27272a"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={width - padding.right + 8}
                  y={y + 4}
                  fill="#71717a"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  ${priceLevel.toFixed(priceDecimals)}
                </text>
              </g>
            );
          })}

          {/* Volatility Bands (Upper & Lower ± Early Trigger Barrier) */}
          {showBands && upperBandPath && lowerBandPath && (
            <>
              <path
                d={upperBandPath}
                fill="none"
                stroke="#6366f1"
                strokeWidth="1.2"
                strokeDasharray="4 4"
                opacity="0.6"
              />
              <path
                d={lowerBandPath}
                fill="none"
                stroke="#6366f1"
                strokeWidth="1.2"
                strokeDasharray="4 4"
                opacity="0.6"
              />
            </>
          )}

          {/* Target Strike Reference Line */}
          {showStrike && strikeY >= padding.top && strikeY <= padding.top + innerHeight && (
            <g>
              <line
                x1={padding.left}
                y1={strikeY}
                x2={width - padding.right}
                y2={strikeY}
                stroke="#f59e0b"
                strokeWidth="1.8"
                strokeDasharray="6 4"
              />
              {/* Strike Tag on Y-axis */}
              <rect
                x={width - padding.right + 2}
                y={strikeY - 9}
                width={76}
                height={18}
                rx={4}
                fill="#f59e0b"
              />
              <text
                x={width - padding.right + 5}
                y={strikeY + 3}
                fill="#000"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
              >
                K: ${strikePrice.toFixed(priceDecimals)}
              </text>
            </g>
          )}

          {/* Live Spot Level Reference Line */}
          {spotY >= padding.top && spotY <= padding.top + innerHeight && (
            <g>
              <line
                x1={padding.left}
                y1={spotY}
                x2={width - padding.right}
                y2={spotY}
                stroke={isAboveStrike ? '#10b981' : '#f43f5e'}
                strokeWidth="1.2"
                strokeDasharray="3 3"
                opacity="0.6"
              />
              <rect
                x={width - padding.right + 2}
                y={spotY - 8}
                width={76}
                height={16}
                rx={3}
                fill={isAboveStrike ? '#065f46' : '#881337'}
              />
              <text
                x={width - padding.right + 5}
                y={spotY + 3}
                fill="#ffffff"
                fontSize="8.5"
                fontWeight="bold"
                fontFamily="monospace"
              >
                S: ${spotPrice.toFixed(priceDecimals)}
              </text>
            </g>
          )}

          {/* Dynamic Price-to-Strike Dimension Bracket & Spacing Ruler */}
          {showStrike && Math.abs(spotY - strikeY) > 6 && (
            <g className="transition-all duration-75">
              {/* Vertical Bracket Line */}
              <line
                x1={width - padding.right - 14}
                y1={Math.min(spotY, strikeY)}
                x2={width - padding.right - 14}
                y2={Math.max(spotY, strikeY)}
                stroke="#38bdf8"
                strokeWidth="1.8"
                strokeDasharray="3 2"
              />
              {/* Top Cap */}
              <line
                x1={width - padding.right - 20}
                y1={Math.min(spotY, strikeY)}
                x2={width - padding.right - 8}
                y2={Math.min(spotY, strikeY)}
                stroke="#38bdf8"
                strokeWidth="2"
              />
              {/* Bottom Cap */}
              <line
                x1={width - padding.right - 20}
                y1={Math.max(spotY, strikeY)}
                x2={width - padding.right - 8}
                y2={Math.max(spotY, strikeY)}
                stroke="#38bdf8"
                strokeWidth="2"
              />
              {/* Badge in middle */}
              <g transform={`translate(${width - padding.right - 92}, ${(spotY + strikeY) / 2 - 9})`}>
                <rect
                  width="74"
                  height="18"
                  rx="4"
                  fill="#0f172a"
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  opacity="0.95"
                />
                <text
                  x="37"
                  y="12"
                  textAnchor="middle"
                  fill="#38bdf8"
                  fontSize="8.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  ↕ {Math.abs(spotY - strikeY).toFixed(0)}px ({spreadZoom.toFixed(1)}x)
                </text>
              </g>
            </g>
          )}

          {/* Chart Rendering Mode */}
          {chartType === 'area' ? (
            <>
              {/* Gradient Area Fill */}
              {areaPath && <path d={areaPath} fill="url(#spotAreaGrad)" />}

              {/* Main Spot Line */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke={isAboveStrike ? '#10b981' : '#f43f5e'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Point Markers */}
              {activeCandles.map((d, idx) => (
                <circle
                  key={idx}
                  cx={getX(idx)}
                  cy={getY(d.price)}
                  r={idx === activeCandles.length - 1 ? 4 : 2}
                  fill={isAboveStrike ? '#10b981' : '#f43f5e'}
                  className="transition-all"
                />
              ))}
            </>
          ) : (
            /* Candlestick Mode with Real OHLC */
            activeCandles.map((d, idx) => {
              const x = getX(idx);
              const isGreen = d.close >= d.open;
              const topWickY = getY(d.high);
              const botWickY = getY(d.low);
              const openY = getY(d.open);
              const closeY = getY(d.close);
              const bodyTop = Math.min(openY, closeY);
              const bodyHeight = Math.max(2, Math.abs(closeY - openY));

              return (
                <g key={idx}>
                  {/* Wicks */}
                  <line
                    x1={x}
                    y1={topWickY}
                    x2={x}
                    y2={botWickY}
                    stroke={isGreen ? '#10b981' : '#f43f5e'}
                    strokeWidth="1.2"
                  />
                  {/* Candle Body */}
                  <rect
                    x={x - 4}
                    y={bodyTop}
                    width={8}
                    height={bodyHeight}
                    rx={1}
                    fill={isGreen ? '#10b981' : '#f43f5e'}
                  />
                </g>
              );
            })
          )}

          {/* Signal Callout Marker Overlay */}
          {activeSignal && (
            <g transform={`translate(${getX(activeCandles.length - 1)}, ${getY(spotPrice)})`}>
              <circle r="8" fill="#3b82f6" opacity="0.3" className="animate-ping" />
              <circle r="5" fill="#3b82f6" />
            </g>
          )}

          {/* Hover Overlay Columns */}
          {activeCandles.map((_, idx) => {
            const x = getX(idx);
            const colWidth = innerWidth / Math.max(1, activeCandles.length);
            return (
              <rect
                key={idx}
                x={x - colWidth / 2}
                y={padding.top}
                width={colWidth}
                height={innerHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(idx)}
                className="cursor-crosshair"
              />
            );
          })}
        </svg>
      </div>

      {/* Chart Legend & Metric Explanation */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs text-zinc-400">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-3 h-3 rounded-full ${
                isAboveStrike ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <span className="font-semibold text-zinc-200">
              Live Spot ({asset}): ${spotPrice.toFixed(priceDecimals)}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400">
            <span>Range: ${candleLow.toFixed(priceDecimals)} - ${candleHigh.toFixed(priceDecimals)}</span>
          </div>

          {showStrike && (
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-amber-400" />
              <span>Strike ($K): ${strikePrice.toFixed(priceDecimals)}</span>
            </div>
          )}

          {showBands && (
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t border-dashed border-indigo-400" />
              <span>±{earlyTriggerZ.toFixed(2)}σ Volatility Envelope</span>
            </div>
          )}
        </div>

        <div className="text-[11px] text-zinc-500 font-mono">
          Last Synced: {lastSyncTime || 'Active'}
        </div>
      </div>
    </div>
  );
};
