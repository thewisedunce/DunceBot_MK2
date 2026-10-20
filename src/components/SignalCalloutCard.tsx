import React, { useState } from 'react';
import {
  Send,
  Check,
  Copy,
  Zap,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { ActiveSignal, AssetType } from '../types/bot';

interface SignalCalloutCardProps {
  signal?: ActiveSignal;
  onSendToTelegram?: (signal: ActiveSignal) => void;
  onExecuteOrder?: (signal: ActiveSignal) => void;
  isLiveMode: boolean;
}

export const SignalCalloutCard: React.FC<SignalCalloutCardProps> = ({
  signal,
  onSendToTelegram,
  onExecuteOrder,
  isLiveMode,
}) => {
  const [copied, setCopied] = useState(false);
  const [sentTelegram, setSentTelegram] = useState(false);

  if (!signal) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800/80 border-dashed rounded-2xl p-6 text-center text-zinc-400">
        <div className="w-12 h-12 mx-auto rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-500 mb-3">
          <Zap className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-zinc-300">
          Awaiting Cycle Signal Trigger
        </h4>
        <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1">
          The quantitative engine evaluates markets every 4 seconds. When statistical conviction |Z| reaches
          the trigger barrier or the fallback window opens, an authorized directional callout is generated.
        </p>
      </div>
    );
  }

  const isBullish = signal.direction === 'YES';
  const priceDecimals = signal.asset === 'XRP' ? 4 : signal.asset === 'SOL' ? 3 : 2;

  const handleCopy = () => {
    const text = `🎯 ${signal.asset} 15M DIRECTIONAL SIGNAL [${signal.mode === 'PAPER' ? '🧪 PAPER TRADE' : '🚨 LIVE ORDER'}]
👉 ${signal.biasTitle}

• Contract: ${signal.ticker}
• ${signal.asset} Spot: $${signal.spotAtCall.toFixed(priceDecimals)}
• Target Strike: $${signal.strike.toFixed(priceDecimals)}
• Clearance Buffer: ${signal.clearanceBuffer >= 0 ? '+' : ''}$${signal.clearanceBuffer.toFixed(priceDecimals)}

📊 Statistical Factor Engine:
• Trade Conviction (|Z|): ${signal.absZ.toFixed(2)}σ
• Directional Bias (Z): ${signal.zScore >= 0 ? '+' : ''}${signal.zScore.toFixed(2)}σ
• Realized Vol (Ann.): ${(signal.realizedVol * 100).toFixed(1)}%
• Model Win Probability: ${(signal.modelProb * 100).toFixed(1)}%
• Market Ask: ${signal.askCents}¢
• Time Remaining: ~${signal.timeRemainingMin.toFixed(1)} minutes

📌 Trigger Mechanism: ${signal.triggerReason}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTelegram = () => {
    onSendToTelegram?.(signal);
    setSentTelegram(true);
    setTimeout(() => setSentTelegram(false), 2000);
  };

  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 text-zinc-100 shadow-2xl relative overflow-hidden transition-all ${
        isBullish
          ? 'bg-gradient-to-b from-emerald-950/40 to-zinc-900 border-emerald-500/40'
          : 'bg-gradient-to-b from-rose-950/40 to-zinc-900 border-rose-500/40'
      }`}
    >
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl text-white ${
              isBullish ? 'bg-emerald-600' : 'bg-rose-600'
            }`}
          >
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight text-white">
                {signal.asset} 15M DIRECTIONAL SIGNAL
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  signal.mode === 'PAPER'
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                }`}
              >
                {signal.mode === 'PAPER' ? '🧪 PAPER TRADE' : '🚨 LIVE KALSHI ORDER'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Triggered at {signal.time} • Mechanism: {signal.triggerReason}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Callout'}</span>
          </button>
          <button
            onClick={handleSendTelegram}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1.5 shadow-md shadow-blue-600/20"
          >
            {sentTelegram ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
            <span>{sentTelegram ? 'Sent to Bot' : 'Send Telegram'}</span>
          </button>
        </div>
      </div>

      {/* Main Callout Banner */}
      <div className="mt-4 p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
            Executive Quantitative Callout
          </span>
          <span
            className={`text-xl sm:text-2xl font-black tracking-tight ${
              isBullish ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {signal.biasTitle}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-right">
            <span className="text-zinc-500 block text-[10px]">ENTRY ASK</span>
            <span className="text-base font-bold text-white bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              {signal.askCents}¢
            </span>
          </div>
          <div className="text-right">
            <span className="text-zinc-500 block text-[10px]">TIME LEFT</span>
            <span className="text-base font-bold text-white">
              ~{signal.timeRemainingMin.toFixed(1)}m
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Checklist */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/80">
          <span className="text-zinc-500 text-[10px] block uppercase">Target Contract</span>
          <span className="text-zinc-200 font-bold">{signal.ticker}</span>
        </div>
        <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/80">
          <span className="text-zinc-500 text-[10px] block uppercase">Spot At Call</span>
          <span className="text-zinc-200 font-bold">${signal.spotAtCall.toFixed(priceDecimals)}</span>
        </div>
        <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/80">
          <span className="text-zinc-500 text-[10px] block uppercase">Strike Target</span>
          <span className="text-zinc-200 font-bold">${signal.strike.toFixed(priceDecimals)}</span>
        </div>
        <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/80">
          <span className="text-zinc-500 text-[10px] block uppercase">Model Win Prob</span>
          <span className="text-emerald-400 font-bold">{(signal.modelProb * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
};
