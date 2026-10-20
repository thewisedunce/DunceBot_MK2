import React from 'react';
import {
  Sliders,
  Shield,
  Percent,
  CheckCircle2,
  X,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { AssetBotState } from '../types/bot';
import { normalCdf } from '../utils/quantEngine';

interface RiskControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  botState: AssetBotState;
  onUpdateConfig: (updates: Partial<AssetBotState>) => void;
  onResetDefaults: () => void;
}

export const RiskControlPanel: React.FC<RiskControlPanelProps> = ({
  isOpen,
  onClose,
  botState,
  onUpdateConfig,
  onResetDefaults,
}) => {
  if (!isOpen) return null;

  const {
    earlyTriggerZ,
    contractsPerTrade,
    maxEntryPriceCents,
    minEntryPriceCents,
    minVol,
    asset,
  } = botState;

  const targetWinProb = normalCdf(earlyTriggerZ) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 text-zinc-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Statistical Risk & Execution Controls ({asset})
              </h3>
              <p className="text-xs text-zinc-400">
                Adjust quantitative thresholds matching Telegram command (/setz)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
            aria-label="Close risk panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          {/* EARLY TRIGGER Z BARRIER */}
          <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-white uppercase tracking-wider block">
                  Early Breakout Barrier (EARLY_TRIGGER_Z)
                </label>
                <span className="text-[11px] text-zinc-400">
                  Target Win Probability: ~{targetWinProb.toFixed(1)}%
                </span>
              </div>
              <span className="text-base font-extrabold font-mono text-blue-400 bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-800/40">
                {earlyTriggerZ.toFixed(2)}σ
              </span>
            </div>
            <input
              type="range"
              min="0.20"
              max="2.50"
              step="0.05"
              value={earlyTriggerZ}
              onChange={(e) =>
                onUpdateConfig({ earlyTriggerZ: parseFloat(e.target.value) })
              }
              className="w-full accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>0.20σ (~57.9%)</span>
              <span>1.00σ (~84.1% Default)</span>
              <span>1.64σ (~95.0%)</span>
              <span>2.50σ (~99.4%)</span>
            </div>
          </div>

          {/* CONTRACTS PER TRADE */}
          <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-white uppercase tracking-wider block">
                  Contracts Per Trade
                </label>
                <span className="text-[11px] text-zinc-400">
                  Kalshi binary contracts executed per authorized signal
                </span>
              </div>
              <span className="text-base font-extrabold font-mono text-white bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800">
                {contractsPerTrade} contracts
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={contractsPerTrade}
              onChange={(e) =>
                onUpdateConfig({ contractsPerTrade: parseInt(e.target.value, 10) })
              }
              className="w-full accent-blue-500 cursor-pointer"
            />
          </div>

          {/* ENTRY PRICE SPREAD CENTS */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                Min Entry Price
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={minEntryPriceCents}
                  onChange={(e) =>
                    onUpdateConfig({ minEntryPriceCents: parseInt(e.target.value, 10) || 5 })
                  }
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white font-mono"
                />
                <span className="text-xs text-zinc-500">¢</span>
              </div>
            </div>

            <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                Max Entry Price
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="50"
                  max="99"
                  value={maxEntryPriceCents}
                  onChange={(e) =>
                    onUpdateConfig({ maxEntryPriceCents: parseInt(e.target.value, 10) || 95 })
                  }
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white font-mono"
                />
                <span className="text-xs text-zinc-500">¢</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-zinc-800 flex items-center justify-between">
          <button
            onClick={onResetDefaults}
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
