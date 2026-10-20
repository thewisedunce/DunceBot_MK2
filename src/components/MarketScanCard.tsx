import React from 'react';
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  AlertCircle,
  ShieldAlert,
  ArrowRight,
  Activity,
} from 'lucide-react';
import { AssetBotState } from '../types/bot';

interface MarketScanCardProps {
  botState: AssetBotState;
  onSimulatePriceMove?: (deltaPct: number) => void;
  onTriggerManualCycle?: () => void;
}

export const MarketScanCard: React.FC<MarketScanCardProps> = ({
  botState,
  onSimulatePriceMove,
  onTriggerManualCycle,
}) => {
  const {
    asset,
    ticker,
    name,
    spotPrice,
    strikePrice,
    timeRemainingSec,
    cycleTotalSec,
    cycleNumber,
    marketYesAsk,
    marketNoAsk,
    isLockedOut,
    earlyTriggerZ,
    absZ,
    signaledInCurrentCycle,
  } = botState;

  const distance = spotPrice - strikePrice;
  const isAboveStrike = distance >= 0;
  const priceDecimals = asset === 'XRP' ? 4 : asset === 'SOL' ? 3 : 2;

  const minutesRem = Math.floor(timeRemainingSec / 60);
  const secondsRem = Math.floor(timeRemainingSec % 60);
  const cycleProgressPct = ((cycleTotalSec - timeRemainingSec) / cycleTotalSec) * 100;

  // Phase calculation
  let phaseName = 'Early Monitoring';
  let phaseColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';

  if (timeRemainingSec <= 30) {
    phaseName = 'Final 30s Lockout';
    phaseColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  } else if (timeRemainingSec <= 90) {
    phaseName = 'Fallback Decision Window (≤ 1.5m)';
    phaseColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  } else {
    phaseName = `Early Breakout Barrier (|Z| ≥ ${earlyTriggerZ.toFixed(2)}σ)`;
    phaseColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  }

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 sm:p-6 text-zinc-100 shadow-xl relative overflow-hidden">
      {/* Background radial accent */}
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-zinc-800 border border-zinc-700/60 font-mono text-sm font-bold text-white">
            {ticker}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                {name} 15-Minute Cycle #{cycleNumber}
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${phaseColor}`}>
                {phaseName}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Strict 1-Callout-Per-Cycle Statistical Execution Guard
            </p>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2">
          {signaledInCurrentCycle ? (
            <span className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 fill-current" /> Callout Fired (Locked)
            </span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Arming Signal Trigger
            </span>
          )}
        </div>
      </div>

      {/* Spot vs Strike Display */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Spot Price */}
        <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span>Aggregated Spot ({asset}/USD)</span>
            <span className="text-[10px] text-emerald-400">Live Multi-Feed</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">
              ${spotPrice.toFixed(priceDecimals)}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <button
              onClick={() => onSimulatePriceMove?.(0.002)}
              className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:bg-emerald-950 hover:text-emerald-300 transition-colors"
              title="Simulate +0.2% price uptick"
            >
              +0.2%
            </button>
            <button
              onClick={() => onSimulatePriceMove?.(-0.002)}
              className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:bg-rose-950 hover:text-rose-300 transition-colors"
              title="Simulate -0.2% price downtick"
            >
              -0.2%
            </button>
            <span className="text-[10px] text-zinc-500 ml-auto">Simulate Vol</span>
          </div>
        </div>

        {/* Target Strike */}
        <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span>Target Strike Price</span>
            <Target className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-zinc-200 tracking-tight">
              ${strikePrice.toFixed(priceDecimals)}
            </span>
          </div>
          <p className="mt-2 text-[10px] text-zinc-500">
            Binary settlement condition: Spot ≥ Strike
          </p>
        </div>

        {/* Clearance Buffer */}
        <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span>Clearance Buffer</span>
            {isAboveStrike ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            )}
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span
              className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
                isAboveStrike ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isAboveStrike ? '+' : ''}${distance.toFixed(priceDecimals)}
            </span>
          </div>
          <p className="mt-2 text-[10px] text-zinc-400">
            {isAboveStrike ? 'Bullish clearance (YES favored)' : 'Bearish deficit (NO favored)'}
          </p>
        </div>
      </div>

      {/* Cycle Countdown & Timeline Progress */}
      <div className="mt-5 p-4 rounded-xl bg-zinc-950/40 border border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400 flex items-center gap-1.5 font-medium">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            Cycle Expiry Clock
          </span>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold text-white">
              {String(minutesRem).padStart(2, '0')}:{String(secondsRem).padStart(2, '0')}
            </span>
            <span className="text-zinc-500 text-[11px]">
              ({timeRemainingSec.toFixed(0)}s remaining)
            </span>
          </div>
        </div>

        {/* Progress Bar with phases */}
        <div className="relative w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              timeRemainingSec <= 30
                ? 'bg-rose-500'
                : timeRemainingSec <= 90
                ? 'bg-amber-500'
                : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, cycleProgressPct))}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-zinc-500 gap-1 overflow-hidden">
          <span className="shrink-0">00:00</span>
          <span className="text-emerald-400/80 truncate hidden sm:inline">
            Early Breakout (|Z| ≥ {earlyTriggerZ.toFixed(2)}σ)
          </span>
          <span className="text-emerald-400/80 sm:hidden">
            ≥{earlyTriggerZ.toFixed(1)}σ
          </span>
          <span className="text-amber-400/80 shrink-0">Fallback (1:30)</span>
          <span className="text-rose-400/80 shrink-0">Lockout (0:30)</span>
        </div>
      </div>

      {/* Order Book Depth & Ask Spreads */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800/80">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">YES Book:</span>
            <span className="text-zinc-500 text-[10px]">
              Bid {botState.marketYesBid ?? (marketYesAsk - 1)}¢ /
            </span>
            <span className="font-bold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
              Ask {marketYesAsk}¢
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">NO Book:</span>
            <span className="text-zinc-500 text-[10px]">
              Bid {botState.marketNoBid ?? (marketNoAsk - 1)}¢ /
            </span>
            <span className="font-bold text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded border border-rose-800/40">
              Ask {marketNoAsk}¢
            </span>
          </div>
          {botState.isKalshiLiveFeed && (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Live Kalshi Book
            </span>
          )}
          {botState.openInterest !== undefined && botState.openInterest > 0 && (
            <span className="text-[10px] text-zinc-400 hidden md:inline">
              OI: ${(botState.openInterest).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          )}
        </div>

        <button
          onClick={onTriggerManualCycle}
          className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
        >
          <span>Trigger Next Cycle</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
