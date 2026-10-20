import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Table,
  CheckCircle2,
  TrendingUp,
  X,
  FileText,
} from 'lucide-react';
import { SettledCycleRecord } from '../types/bot';
import { computeDescriptiveStats } from '../utils/quantEngine';

interface ExcelAnalyticsViewerProps {
  isOpen: boolean;
  onClose: () => void;
  records: SettledCycleRecord[];
  onDownloadCsv: () => void;
}

export const ExcelAnalyticsViewer: React.FC<ExcelAnalyticsViewerProps> = ({
  isOpen,
  onClose,
  records,
  onDownloadCsv,
}) => {
  const [activeSheet, setActiveSheet] = useState<'summary' | 'raw'>('summary');

  if (!isOpen) return null;

  // Extract statistical arrays matching Python ExcelExporter
  const tradeReturns = records.map((r) => r.tradeReturnPct);
  const mktReturns = records.map((r) => r.marketBaselineReturnPct);
  const spotMoves = records.map((r) => r.spotMovePct);
  const vols = records.map((r) => r.vol);
  const absZs = records.map((r) => r.absZ);
  const zScores = records.map((r) => r.zScore);
  const modelProbs = records.map((r) => r.modelProb);
  const asks = records.map((r) => r.askAtCall);
  const pnls = records.map((r) => r.pnlDollars);

  const statsRet = computeDescriptiveStats(tradeReturns);
  const statsVol = computeDescriptiveStats(vols);
  const statsProb = computeDescriptiveStats(modelProbs);
  const statsAsk = computeDescriptiveStats(asks);
  const statsAbsZ = computeDescriptiveStats(absZs);
  const statsZ = computeDescriptiveStats(zScores);
  const statsMkt = computeDescriptiveStats(mktReturns);

  // Summary benchmark calculations
  const totalTrades = records.length;
  const wins = records.filter((r) => r.outcomeLabel === 'WIN').length;
  const stratWinRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

  const mktWins = records.filter((r) => r.marketYesWon).length;
  const mktWinRate = totalTrades > 0 ? (mktWins / totalTrades) * 100 : 0;

  const avgStratRet = statsRet.mean * 100;
  const avgMktRet = statsMkt.mean * 100;
  const avgSpotMove =
    spotMoves.length > 0
      ? (spotMoves.reduce((a, b) => a + b, 0) / spotMoves.length) * 100
      : 0;
  const alphaMkt = avgStratRet - avgMktRet;

  const totalProfit = pnls.filter((p) => p > 0).reduce((a, b) => a + b, 0);
  const totalLoss = Math.abs(pnls.filter((p) => p < 0).reduce((a, b) => a + b, 0));
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 99.9 : 0;

  const descRows: Array<{ label: string; key: keyof typeof statsRet }> = [
    { label: 'Observation Count', key: 'count' },
    { label: 'Mean (Average)', key: 'mean' },
    { label: 'Standard Deviation (σ)', key: 'stdev' },
    { label: 'Minimum', key: 'min' },
    { label: '25th Percentile (Q1)', key: 'q25' },
    { label: 'Median (50th Percentile)', key: 'median' },
    { label: '75th Percentile (Q3)', key: 'q75' },
    { label: 'Maximum', key: 'max' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-zinc-100 my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Excel Analytics & Descriptive Statistics Report
              </h2>
              <p className="text-xs text-zinc-400">
                Mirrors Python openpyxl automated export tables with benchmark alpha & statistical moments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onDownloadCsv}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              <Download className="w-3.5 h-3.5" />
              Download .CSV
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sheet Tabs */}
        <div className="flex items-center gap-2 mt-4 pb-2 border-b border-zinc-800 text-xs">
          <button
            onClick={() => setActiveSheet('summary')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeSheet === 'summary'
                ? 'bg-zinc-800 text-white border border-zinc-700'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            <Table className="w-3.5 h-3.5 text-blue-400" />
            <span>Sheet 2: Summary_Analytics</span>
          </button>
          <button
            onClick={() => setActiveSheet('raw')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              activeSheet === 'raw'
                ? 'bg-zinc-800 text-white border border-zinc-700'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sheet 1: Cycle_Raw_Data ({records.length} records)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-6">
          {activeSheet === 'summary' ? (
            <>
              {/* Table 1: Benchmark Comparison */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  1. Benchmark Performance Comparison Table
                </h4>
                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#1F497D] text-white text-[11px] font-bold">
                      <tr>
                        <th className="py-2.5 px-3.5">Metric</th>
                        <th className="py-2.5 px-3.5">DunceBot Strategy</th>
                        <th className="py-2.5 px-3.5">Entire Market Baseline (Naive YES)</th>
                        <th className="py-2.5 px-3.5">Underlying Spot Move</th>
                        <th className="py-2.5 px-3.5 text-right">Alpha (Outperformance)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800 bg-zinc-950/60">
                      <tr>
                        <td className="py-2.5 px-3.5 font-sans font-medium text-zinc-300">
                          Average Return % per Cycle
                        </td>
                        <td className="py-2.5 px-3.5 font-bold text-emerald-400">
                          {avgStratRet >= 0 ? '+' : ''}{avgStratRet.toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3.5 text-zinc-300">
                          {avgMktRet >= 0 ? '+' : ''}{avgMktRet.toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3.5 text-zinc-400">
                          {avgSpotMove >= 0 ? '+' : ''}{avgSpotMove.toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-blue-400">
                          {alphaMkt >= 0 ? '+' : ''}{alphaMkt.toFixed(2)}%
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3.5 font-sans font-medium text-zinc-300">
                          Win Rate %
                        </td>
                        <td className="py-2.5 px-3.5 font-bold text-emerald-400">
                          {stratWinRate.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3.5 text-zinc-300">
                          {mktWinRate.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3.5 text-zinc-500">N/A</td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-blue-400">
                          {stratWinRate - mktWinRate >= 0 ? '+' : ''}
                          {(stratWinRate - mktWinRate).toFixed(1)}%
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3.5 font-sans font-medium text-zinc-300">
                          Cumulative Net PnL ($)
                        </td>
                        <td className="py-2.5 px-3.5 font-bold text-emerald-400">
                          ${pnls.reduce((a, b) => a + b, 0).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3.5 text-zinc-500">N/A</td>
                        <td className="py-2.5 px-3.5 text-zinc-500">N/A</td>
                        <td className="py-2.5 px-3.5 text-right text-zinc-500">-</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3.5 font-sans font-medium text-zinc-300">
                          Profit Factor
                        </td>
                        <td className="py-2.5 px-3.5 font-bold text-white">
                          {profitFactor.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3.5 text-zinc-500">N/A</td>
                        <td className="py-2.5 px-3.5 text-zinc-500">N/A</td>
                        <td className="py-2.5 px-3.5 text-right text-zinc-500">-</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3.5 font-sans font-medium text-zinc-300">
                          Completed Cycles Evaluated
                        </td>
                        <td className="py-2.5 px-3.5 text-white">{totalTrades}</td>
                        <td className="py-2.5 px-3.5 text-zinc-400">{totalTrades}</td>
                        <td className="py-2.5 px-3.5 text-zinc-400">{totalTrades}</td>
                        <td className="py-2.5 px-3.5 text-right text-zinc-500">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table 2: Descriptive Statistics Table */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  2. Descriptive Statistics Summary Table
                </h4>
                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#595959] text-white text-[11px] font-bold">
                      <tr>
                        <th className="py-2.5 px-3">Statistic</th>
                        <th className="py-2.5 px-3">Trade Return %</th>
                        <th className="py-2.5 px-3">Realized Vol</th>
                        <th className="py-2.5 px-3">Model Win Prob</th>
                        <th className="py-2.5 px-3">Entry Price (¢)</th>
                        <th className="py-2.5 px-3">Conviction (|Z|)</th>
                        <th className="py-2.5 px-3">Directional Z</th>
                        <th className="py-2.5 px-3">Mkt Baseline %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800 bg-zinc-950/60">
                      {descRows.map((row) => {
                        const isCount = row.key === 'count';
                        return (
                          <tr key={row.label} className="hover:bg-zinc-800/30">
                            <td className="py-2 px-3 font-sans font-medium text-zinc-300">
                              {row.label}
                            </td>
                            <td className="py-2 px-3 text-emerald-400">
                              {isCount
                                ? statsRet.count
                                : `${(statsRet[row.key] * 100).toFixed(1)}%`}
                            </td>
                            <td className="py-2 px-3 text-zinc-200">
                              {isCount
                                ? statsVol.count
                                : `${(statsVol[row.key] * 100).toFixed(1)}%`}
                            </td>
                            <td className="py-2 px-3 text-indigo-300">
                              {isCount
                                ? statsProb.count
                                : `${(statsProb[row.key] * 100).toFixed(1)}%`}
                            </td>
                            <td className="py-2 px-3 text-zinc-200">
                              {isCount
                                ? statsAsk.count
                                : `${statsAsk[row.key].toFixed(1)}¢`}
                            </td>
                            <td className="py-2 px-3 text-white">
                              {isCount
                                ? statsAbsZ.count
                                : `${statsAbsZ[row.key].toFixed(2)}σ`}
                            </td>
                            <td className="py-2 px-3 text-zinc-200">
                              {isCount
                                ? statsZ.count
                                : `${statsZ[row.key] >= 0 ? '+' : ''}${statsZ[row.key].toFixed(2)}σ`}
                            </td>
                            <td className="py-2 px-3 text-zinc-400">
                              {isCount
                                ? statsMkt.count
                                : `${(statsMkt[row.key] * 100).toFixed(1)}%`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            /* Raw Cycles Data Table */
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#1F497D] text-white text-[10px] tracking-wider uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Call Time</th>
                    <th className="py-2.5 px-3">Settle Time</th>
                    <th className="py-2.5 px-3">Contract</th>
                    <th className="py-2.5 px-3">Side</th>
                    <th className="py-2.5 px-3">Spot</th>
                    <th className="py-2.5 px-3">Strike</th>
                    <th className="py-2.5 px-3">Settle Spot</th>
                    <th className="py-2.5 px-3">Ask</th>
                    <th className="py-2.5 px-3">Outcome</th>
                    <th className="py-2.5 px-3 text-right">PnL</th>
                    <th className="py-2.5 px-3 text-right">Return %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 bg-zinc-950/60">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-800/30">
                      <td className="py-2 px-3 text-zinc-400 text-[11px]">{r.callTimeStr}</td>
                      <td className="py-2 px-3 text-zinc-400 text-[11px]">{r.settleTimeStr}</td>
                      <td className="py-2 px-3 font-bold text-zinc-200">{r.ticker}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            r.side === 'YES' ? 'text-emerald-400 bg-emerald-950' : 'text-rose-400 bg-rose-950'
                          }`}
                        >
                          {r.side}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-zinc-300">${r.spotAtCall.toFixed(2)}</td>
                      <td className="py-2 px-3 text-zinc-300">${r.strike.toFixed(2)}</td>
                      <td className="py-2 px-3 text-zinc-300">${r.settleSpot.toFixed(2)}</td>
                      <td className="py-2 px-3 text-zinc-400">{r.askAtCall}¢</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.outcomeLabel === 'WIN'
                              ? 'text-emerald-400 bg-emerald-950/80 border border-emerald-800/50'
                              : 'text-rose-400 bg-rose-950/80 border border-rose-800/50'
                          }`}
                        >
                          {r.outcomeLabel}
                        </span>
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-bold ${
                          r.pnlDollars >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {r.pnlDollars >= 0 ? '+' : ''}${r.pnlDollars.toFixed(2)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-bold ${
                          r.tradeReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {r.tradeReturnPct >= 0 ? '+' : ''}
                        {(r.tradeReturnPct * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
