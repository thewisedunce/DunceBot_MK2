import React from 'react';
import {
  TrendingUp,
  Shield,
  Key,
  Sliders,
  Code2,
  FileSpreadsheet,
  Play,
  Pause,
  AlertTriangle,
  Sparkles,
  Zap,
  Bot,
  MessageSquare,
} from 'lucide-react';
import { AssetType, UserSecrets } from '../types/bot';

interface HeaderNavProps {
  currentAsset: AssetType;
  onSelectAsset: (asset: AssetType) => void;
  isRunning: boolean;
  onToggleRunning: () => void;
  isDryRun: boolean;
  onToggleDryRun: () => void;
  virtualBalance: number;
  secrets: UserSecrets;
  onOpenSecretsModal: () => void;
  onOpenCodeModal: () => void;
  onOpenRiskModal: () => void;
  onOpenExcelModal: () => void;
  onOpenPaywallModal: () => void;
  onOpenWhitelistModal: () => void;
  isWhitelisted: boolean;
  hasPaid: boolean;
  isTelegramOpen?: boolean;
  onToggleTelegram?: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  currentAsset,
  onSelectAsset,
  isRunning,
  onToggleRunning,
  isDryRun,
  onToggleDryRun,
  virtualBalance,
  secrets,
  onOpenSecretsModal,
  onOpenCodeModal,
  onOpenRiskModal,
  onOpenExcelModal,
  onOpenPaywallModal,
  onOpenWhitelistModal,
  isWhitelisted,
  hasPaid,
  isTelegramOpen = true,
  onToggleTelegram,
}) => {
  const assets: Array<{ id: AssetType; name: string; symbol: string; ticker: string }> = [
    { id: 'BTC', name: 'Bitcoin', symbol: '🪙 BTC', ticker: 'KXBTC15M' },
    { id: 'SOL', name: 'Solana', symbol: '🟣 SOL', ticker: 'KXSOL15M' },
    { id: 'XRP', name: 'XRP', symbol: '⚫ XRP', ticker: 'KXXRP15M' },
  ];

  const netPnl = virtualBalance - 100.0;
  const isPnlPositive = netPnl >= 0;

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">
                  DUNCE_BOT
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Kalshi 15M
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                Statistical Directional Call-Out & Order Execution Suite
              </p>
            </div>
          </div>

          {/* Asset Tabs */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-xl shrink-0 overflow-x-auto no-scrollbar">
            {assets.map((asset) => {
              const isActive = currentAsset === asset.id;
              return (
                <button
                  key={asset.id}
                  onClick={() => onSelectAsset(asset.id)}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 shrink-0 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  <span>{asset.symbol}</span>
                  <span className={`text-[10px] font-mono ${isActive ? 'text-blue-100' : 'text-zinc-500'}`}>
                    15M
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Kalshi Real / Virtual Bankroll */}
            <div className="hidden lg:flex flex-col items-end px-3 py-1 bg-zinc-900/90 border border-zinc-800 rounded-xl">
              <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider flex items-center gap-1">
                {secrets.verifiedBalance !== undefined ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Kalshi Real Balance
                  </>
                ) : (
                  'Virtual Bankroll'
                )}
              </span>
              <div className="flex items-center gap-1 font-mono text-xs font-bold text-white">
                <span>
                  ${secrets.verifiedBalance !== undefined ? secrets.verifiedBalance.toFixed(2) : virtualBalance.toFixed(2)}
                </span>
                <span
                  className={`text-[10px] ${
                    isPnlPositive ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  ({isPnlPositive ? '+' : ''}${netPnl.toFixed(2)})
                </span>
              </div>
            </div>

            {/* Dry Run / Live Switch */}
            <button
              onClick={onToggleDryRun}
              className={`px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1 ${
                isDryRun
                  ? 'bg-amber-950/30 border-amber-800/50 text-amber-300 hover:bg-amber-900/30'
                  : 'bg-rose-950/40 border-rose-800 text-rose-300 hover:bg-rose-900/40 animate-pulse'
              }`}
              title="Click to toggle Paper Trading vs Live Kalshi Orders"
            >
              <span>{isDryRun ? '🧪 Paper' : '🚨 LIVE'}</span>
            </button>

            {/* Engine Play/Pause */}
            <button
              onClick={onToggleRunning}
              className={`p-1.5 sm:p-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1 ${
                isRunning
                  ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-400 hover:bg-emerald-900/30'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
              title={isRunning ? 'Pause Engine' : 'Resume Engine'}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-emerald-400" />}
              <span className="hidden xl:inline text-xs">
                {isRunning ? 'Running' : 'Paused'}
              </span>
            </button>

            {/* Whitelist / License Status Badge */}
            <button
              onClick={isWhitelisted || hasPaid ? onOpenWhitelistModal : onOpenPaywallModal}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 ${
                isWhitelisted
                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20'
                  : hasPaid
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 animate-pulse'
              }`}
              title={
                isWhitelisted
                  ? 'Device Whitelisted (Payment Omitted)'
                  : hasPaid
                  ? 'Active License'
                  : 'Payment Required to Load Keys'
              }
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">
                {isWhitelisted
                  ? 'Whitelisted'
                  : hasPaid
                  ? 'License Active'
                  : 'Paywall Gate'}
              </span>
            </button>

            {/* Secret Vault Badge / Login Prompt */}
            <button
              onClick={onOpenSecretsModal}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 ${
                secrets.verifiedBalance !== undefined
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 shadow-sm shadow-emerald-500/10'
                  : secrets.kalshiPrivateKeyContent
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {secrets.verifiedBalance !== undefined
                  ? `Kalshi Live (${secrets.latencyMs || 45}ms)`
                  : secrets.kalshiPrivateKeyContent
                  ? 'Key Loaded'
                  : 'Login / Set Secrets'}
              </span>
            </button>

            {/* Telegram Sidebox Toggle */}
            <button
              onClick={onToggleTelegram}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 ${
                isTelegramOpen
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-300 shadow-sm'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title={isTelegramOpen ? 'Hide Telegram Sidebox' : 'Show Telegram Sidebox'}
            >
              <Bot className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Telegram Feed</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            </button>

            {/* Code / Templates */}
            <button
              onClick={onOpenCodeModal}
              className="p-1.5 sm:p-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              title="View Python Source Templates & Export"
            >
              <Code2 className="w-4 h-4" />
            </button>

            {/* Risk Slider Modal Trigger */}
            <button
              onClick={onOpenRiskModal}
              className="p-1.5 sm:p-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Risk Parameters & /setz Config"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
