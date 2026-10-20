import React from 'react';
import {
  Gauge,
  Percent,
  TrendingUp,
  TrendingDown,
  Info,
  CheckCircle2,
  AlertTriangle,
  Compass,
} from 'lucide-react';
import { AssetBotState } from '../types/bot';

interface QuantFactorRadarProps {
  botState: AssetBotState;
}

export const QuantFactorRadar: React.FC<QuantFactorRadarProps> = ({ botState }) => {
  const {
    zScore,
    absZ,
    modelProb,
    realizedVol,
    minVol,
    earlyTriggerZ,
    currentDirection,
  } = botState;

  const isBullish = currentDirection === 'YES';
  const triggerReady = absZ >= earlyTriggerZ;
  const convictionRatio = Math.min(100, (absZ / (earlyTriggerZ * 1.5)) * 100);

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 sm:p-6 text-zinc-100 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-xl">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Quantitative Factor Engine
            </h3>
            <p className="text-xs text-zinc-400">
              Black-Scholes Binary Option d2 Formulation & Realized Volatility
            </p>
          </div>
        </div>

        {/* Directional Call Badge */}
        <div
          className={`px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 shadow-sm ${
            isBullish
              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/70 border-rose-500/50 text-rose-300'
          }`}
        >
          {isBullish ? (
            <>
              <TrendingUp className="w-4 h-4" />
              <span>BUY YES (BULLISH)</span>
            </>
          ) : (
            <>
              <TrendingDown className="w-4 h-4" />
              <span>BUY NO (BEARISH)</span>
            </>
          )}
        </div>
      </div>

      {/* Grid of Quant Gauges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Signed Directional Z */}
        <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Directional Z (Signed)
          </div>
          <div className="mt-1 flex items-baseline gap-1.5 font-mono">
            <span
              className={`text-2xl font-black ${
                zScore >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {zScore >= 0 ? '+' : ''}
              {zScore.toFixed(2)}σ
            </span>
          </div>
          <p className="mt-1 text-[10px] text-zinc-500">
            d2 = [ln(S/K) - ½σ²t] / [σ√t]
          </p>
        </div>

        {/* Trade Conviction |Z| */}
        <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            <span className="truncate">Conviction (|Z|)</span>
            <span className="text-[10px] text-blue-400 font-mono shrink-0">
              Target: {earlyTriggerZ.toFixed(2)}σ
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5 font-mono">
            <span className="text-2xl font-black text-white">
              {absZ.toFixed(2)}σ
            </span>
            {triggerReady && (
              <span className="text-[10px] text-emerald-400 font-sans font-bold flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> Barrier Met
              </span>
            )}
          </div>
          {/* Conviction mini meter */}
          <div className="mt-2 w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                triggerReady ? 'bg-emerald-400' : 'bg-blue-500'
              }`}
              style={{ width: `${convictionRatio}%` }}
            />
          </div>
        </div>

        {/* Model Win Probability */}
        <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Model Win Probability
          </div>
          <div className="mt-1 flex items-baseline gap-1.5 font-mono">
            <span className="text-2xl font-black text-indigo-300">
              {(modelProb * 100).toFixed(1)}%
            </span>
          </div>
          <p className="mt-1 text-[10px] text-zinc-500">
            N(|Z|) via Gauss Error Function
          </p>
        </div>

        {/* Realized Volatility */}
        <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800">
          <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            <span>Realized Vol (Ann.)</span>
            <span className="text-[10px] text-zinc-500 font-mono">
              Base: {(minVol * 100).toFixed(0)}%
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5 font-mono">
            <span className="text-2xl font-black text-zinc-200">
              {(realizedVol * 100).toFixed(1)}%
            </span>
          </div>
          <p className="mt-1 text-[10px] text-zinc-500">
            5-min rolling window annualized
          </p>
        </div>
      </div>
    </div>
  );
};
