import React from 'react';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Clock,
  Download,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { SettledCycleRecord } from '../types/bot';

interface TrackRecordTableProps {
  records: SettledCycleRecord[];
  virtualBalance: number;
  onExportExcel: () => void;
}

export const TrackRecordTable: React.FC<TrackRecordTableProps> = ({
  records,
  virtualBalance,
  onExportExcel,
}) => {
  const total = records.length;
  const wins = records.filter((r) => r.outcomeLabel === 'WIN').length;
  const losses = total - wins;
  const winRate = total > 0 ? (wins / total) * 100 : 0;

  const totalPnL = records.reduce((acc, r) => acc + r.pnlDollars, 0);
  const totalProfit = records.filter((r) => r.pnlDollars > 0).reduce((acc, r) => acc + r.pnlDollars, 0);
  const totalLoss = Math.abs(records.filter((r) => r.pnlDollars < 0).reduce((acc, r) => acc + r.pnlDollars, 0));
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 99.9 : 0;

  const stratReturns = records.map((r) => r.tradeReturnPct);
  const mktReturns = records.map((r) => r.marketBaselineReturnPct);

  const avgStratReturn =
    stratReturns.length > 0
      ? (stratReturns.reduce((a, b) => a + b, 0) / stratReturns.length) * 100
      : 0;

  const avgMktReturn =
    mktReturns.length > 0
      ? (mktReturns.reduce((a, b) => a + b, 0) / mktReturns.length) * 100
      : 0;

  const alpha = avgStratReturn - avgMktReturn;

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 sm:p-6 text-zinc-100 shadow-xl space-y-5">
      {/* Top Banner with Performance KPI Cards */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Performance Track Record & Settled Cycles
            </h3>
            <p className="text-xs text-zinc-400">
              Evaluated across high-frequency 15-minute Kalshi market expirations
            </p>
          </div>
        </div>

        <button
          onClick={onExportExcel}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
        >
          <Download className="w-4 h-4" />
          <span>Export Excel Report (.xlsx)</span>
        </button>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
        {/* Win Rate */}
        <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl">
          <span className="text-[10px] text-zinc-400 uppercase font-sans font-semibold block">
            Win Rate
          </span>
          <span className="text-xl font-bold text-emerald-400 mt-0.5 block">
            {winRate.toFixed(1)}%
          </span>
          <span className="text-[10px] text-zinc-500 font-sans">
            {wins}W - {losses}L ({total} total)
          </span>
        </div>

        {/* Net PnL */}
        <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl">
          <span className="text-[10px] text-zinc-400 uppercase font-sans font-semibold block">
            Net PnL
          </span>
          <span
            className={`text-xl font-bold mt-0.5 block ${
              totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </span>
          <span className="text-[10px] text-zinc-500 font-sans">
            Bankroll: ${virtualBalance.toFixed(2)}
          </span>
        </div>

        {/* Avg Strategy Return */}
        <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl">
          <span className="text-[10px] text-zinc-400 uppercase font-sans font-semibold block">
            Strategy Return
          </span>
          <span
            className={`text-xl font-bold mt-0.5 block ${
              avgStratReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {avgStratReturn >= 0 ? '+' : ''}
            {avgStratReturn.toFixed(1)}%
          </span>
          <span className="text-[10px] text-zinc-500 font-sans">Avg per 15m cycle</span>
        </div>

        {/* Market Baseline Return */}
        <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl">
          <span className="text-[10px] text-zinc-400 uppercase font-sans font-semibold block">
            Market Baseline
          </span>
          <span
            className={`text-xl font-bold mt-0.5 block ${
              avgMktReturn >= 0 ? 'text-zinc-200' : 'text-rose-400'
            }`}
          >
            {avgMktReturn >= 0 ? '+' : ''}
            {avgMktReturn.toFixed(1)}%
          </span>
          <span className="text-[10px] text-zinc-500 font-sans">Naive Buy-YES baseline</span>
        </div>

        {/* Strategy Alpha */}
        <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl col-span-2 sm:col-span-1">
          <span className="text-[10px] text-zinc-400 uppercase font-sans font-semibold block">
            Net Alpha Outperf.
          </span>
          <span
            className={`text-xl font-bold mt-0.5 block ${
              alpha >= 0 ? 'text-blue-400' : 'text-rose-400'
            }`}
          >
            {alpha >= 0 ? '+' : ''}
            {alpha.toFixed(1)}%
          </span>
          <span className="text-[10px] text-zinc-500 font-sans">
            PF: {profitFactor.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
            <tr>
              <th className="py-3 px-3.5">Call / Settle Time</th>
              <th className="py-3 px-3.5">Contract</th>
              <th className="py-3 px-3.5">Direction</th>
              <th className="py-3 px-3.5">Strike</th>
              <th className="py-3 px-3.5">Settle Spot</th>
              <th className="py-3 px-3.5">Ask</th>
              <th className="py-3 px-3.5">Outcome</th>
              <th className="py-3 px-3.5 text-right">Net PnL</th>
              <th className="py-3 px-3.5 text-right">Strat Return</th>
              <th className="py-3 px-3.5 text-right">Mkt Return</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/40">
            {records.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-zinc-500">
                  No completed cycles logged yet. The engine logs and grades each cycle upon expiry.
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const isWin = r.outcomeLabel === 'WIN';
                const decimals = r.asset === 'XRP' ? 4 : r.asset === 'SOL' ? 3 : 2;
                return (
                  <tr key={r.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-2.5 px-3.5 text-zinc-400 text-[11px]">
                      <div>{r.callTimeStr.split(' ')[1] || r.callTimeStr}</div>
                      <div className="text-[10px] text-zinc-600">
                        {r.settleTimeStr.split(' ')[1] || r.settleTimeStr}
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5 font-bold text-zinc-200">
                      {r.ticker}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.side === 'YES'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                            : 'bg-rose-950 text-rose-400 border border-rose-800/50'
                        }`}
                      >
                        {r.side}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-zinc-300">
                      ${r.strike.toFixed(decimals)}
                    </td>
                    <td className="py-2.5 px-3.5 text-zinc-300 font-semibold">
                      ${r.settleSpot.toFixed(decimals)}
                    </td>
                    <td className="py-2.5 px-3.5 text-zinc-400">
                      {r.askAtCall}¢
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isWin
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {isWin ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {r.outcomeLabel}
                      </span>
                    </td>
                    <td
                      className={`py-2.5 px-3.5 text-right font-bold ${
                        r.pnlDollars >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {r.pnlDollars >= 0 ? '+' : ''}${r.pnlDollars.toFixed(2)}
                    </td>
                    <td
                      className={`py-2.5 px-3.5 text-right font-bold ${
                        r.tradeReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {r.tradeReturnPct >= 0 ? '+' : ''}
                      {(r.tradeReturnPct * 100).toFixed(1)}%
                    </td>
                    <td
                      className={`py-2.5 px-3.5 text-right ${
                        r.marketBaselineReturnPct >= 0
                          ? 'text-zinc-300'
                          : 'text-rose-400'
                      }`}
                    >
                      {r.marketBaselineReturnPct >= 0 ? '+' : ''}
                      {(r.marketBaselineReturnPct * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
