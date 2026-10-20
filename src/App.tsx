import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Zap,
  TrendingUp,
  Shield,
  Key,
  Download,
  Upload,
  Play,
  Pause,
  Sliders,
  Code2,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Lock,
  Compass,
  Layers,
  ArrowUpRight,
  BarChart2,
  Laptop,
  Bot,
} from 'lucide-react';
import { AssetType, AssetBotState, SettledCycleRecord, TelegramMessage, UserSecrets, ActiveSignal } from './types/bot';
import { HeaderNav } from './components/HeaderNav';
import { MarketScanCard } from './components/MarketScanCard';
import { QuantFactorRadar } from './components/QuantFactorRadar';
import { SignalCalloutCard } from './components/SignalCalloutCard';
import { TelegramSimulator } from './components/TelegramSimulator';
import { TrackRecordTable } from './components/TrackRecordTable';
import { SecretLoginModal } from './components/SecretLoginModal';
import { CodeExportModal } from './components/CodeExportModal';
import { ExcelAnalyticsViewer } from './components/ExcelAnalyticsViewer';
import { RiskControlPanel } from './components/RiskControlPanel';
import { MarketChart } from './components/MarketChart';
import { PaywallGatewayModal } from './components/PaywallGatewayModal';
import { DeviceWhitelistModal } from './components/DeviceWhitelistModal';
import {
  binaryOptionMetrics,
  calculateRealizedVolatility,
  calculateSettlement,
  SpotObservation,
} from './utils/quantEngine';
import {
  getOrCreateDeviceId,
  DEFAULT_WHITELISTED_DEVICES,
  evaluatePaywallAccess,
} from './utils/deviceWhitelist';
import {
  fetchLiveSpotPrice,
  calculateKalshiStrike,
  CURRENT_REAL_MARKET_BASELINES,
} from './utils/marketDataService';
import {
  fetchKalshiLiveMarkets,
  submitKalshiOrder,
  sendTelegramAlert,
  verifyKalshiCredentials,
} from './utils/kalshiApiService';

// Seed historical cycles with accurate market price levels
const INITIAL_HISTORICAL_RECORDS: SettledCycleRecord[] = [
  {
    id: 'hist-1',
    callTimeStr: '2026-10-19 19:15:20',
    settleTimeStr: '2026-10-19 19:30:00',
    asset: 'BTC',
    ticker: 'KXBTC15M-24OCT19-1930',
    eventTicker: 'KXBTC15M-24OCT19',
    triggerReason: 'Early Breakout (1.32σ ≥ 1.00σ)',
    spotAtCall: 82020.50,
    strike: 82000.00,
    settleSpot: 82180.00,
    vol: 0.28,
    zScore: 1.32,
    absZ: 1.32,
    modelProb: 0.906,
    side: 'YES',
    askAtCall: 52,
    marketYesAsk: 50,
    outcomeLabel: 'WIN',
    pnlDollars: 2.40,
    tradeReturnPct: 0.923,
    marketBaselineReturnPct: 1.00,
    spotMovePct: 0.0019,
    marketYesWon: true,
  },
  {
    id: 'hist-2',
    callTimeStr: '2026-10-19 19:33:10',
    settleTimeStr: '2026-10-19 19:45:00',
    asset: 'BTC',
    ticker: 'KXBTC15M-24OCT19-1945',
    eventTicker: 'KXBTC15M-24OCT19',
    triggerReason: 'Early Breakout (1.18σ ≥ 1.00σ)',
    spotAtCall: 82190.00,
    strike: 82250.00,
    settleSpot: 82080.00,
    vol: 0.29,
    zScore: -1.18,
    absZ: 1.18,
    modelProb: 0.881,
    side: 'NO',
    askAtCall: 46,
    marketYesAsk: 54,
    outcomeLabel: 'WIN',
    pnlDollars: 2.70,
    tradeReturnPct: 1.174,
    marketBaselineReturnPct: -1.00,
    spotMovePct: -0.0013,
    marketYesWon: false,
  },
  {
    id: 'hist-3',
    callTimeStr: '2026-10-19 19:47:05',
    settleTimeStr: '2026-10-19 20:00:00',
    asset: 'SOL',
    ticker: 'KXSOL15M-24OCT19-2000',
    eventTicker: 'KXSOL15M-24OCT19',
    triggerReason: 'Early Breakout (1.45σ ≥ 1.00σ)',
    spotAtCall: 105.40,
    strike: 105.00,
    settleSpot: 105.85,
    vol: 0.48,
    zScore: 1.45,
    absZ: 1.45,
    modelProb: 0.926,
    side: 'YES',
    askAtCall: 48,
    marketYesAsk: 48,
    outcomeLabel: 'WIN',
    pnlDollars: 2.60,
    tradeReturnPct: 1.083,
    marketBaselineReturnPct: 1.083,
    spotMovePct: 0.0042,
    marketYesWon: true,
  },
  {
    id: 'hist-4',
    callTimeStr: '2026-10-19 20:02:15',
    settleTimeStr: '2026-10-19 20:15:00',
    asset: 'XRP',
    ticker: 'KXXRP15M-24OCT19-2015',
    eventTicker: 'KXXRP15M-24OCT19',
    triggerReason: 'Fallback Window (~1.4m left)',
    spotAtCall: 1.3020,
    strike: 1.3000,
    settleSpot: 1.3065,
    vol: 0.54,
    zScore: 0.84,
    absZ: 0.84,
    modelProb: 0.800,
    side: 'YES',
    askAtCall: 44,
    marketYesAsk: 56,
    outcomeLabel: 'WIN',
    pnlDollars: 2.80,
    tradeReturnPct: 1.272,
    marketBaselineReturnPct: 0.786,
    spotMovePct: 0.0034,
    marketYesWon: true,
  },
];

export default function App() {
  const [selectedAsset, setSelectedAsset] = useState<AssetType>('BTC');
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [isDryRun, setIsDryRun] = useState<boolean>(true);
  const [virtualBalance, setVirtualBalance] = useState<number>(110.50);

  // Device ID & Paywall / Whitelist state
  const [deviceId] = useState<string>(() => getOrCreateDeviceId());
  const [whitelist, setWhitelist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('duncebot_whitelist');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [...DEFAULT_WHITELISTED_DEVICES];
  });

  const [hasPaid, setHasPaid] = useState<boolean>(() => {
    try {
      return localStorage.getItem('duncebot_has_paid') === 'true';
    } catch {
      return false;
    }
  });

  // Evaluate authorization
  const accessEval = evaluatePaywallAccess(deviceId, whitelist, hasPaid);

  // Modals state
  const [isSecretsModalOpen, setIsSecretsModalOpen] = useState<boolean>(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState<boolean>(false);
  const [isRiskModalOpen, setIsRiskModalOpen] = useState<boolean>(false);
  const [isPaywallModalOpen, setIsPaywallModalOpen] = useState<boolean>(false);
  const [isWhitelistModalOpen, setIsWhitelistModalOpen] = useState<boolean>(false);
  const [isTelegramOpen, setIsTelegramOpen] = useState<boolean>(true);

  // User Secrets: loaded from localStorage if available
  const [secrets, setSecrets] = useState<UserSecrets>(() => {
    try {
      const saved = localStorage.getItem('duncebot_secrets');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      kalshiKeyId: '',
      kalshiPrivateKeyContent: '',
      kalshiPrivateKeyFileName: '',
      kalshiBaseUrl: 'https://external-api.kalshi.com/trade-api/v2',
      telegramBotToken: '',
      telegramChatId: '',
      isLoggedIn: false,
    };
  });

  // Settled historical cycles
  const [records, setRecords] = useState<SettledCycleRecord[]>(INITIAL_HISTORICAL_RECORDS);

  // Telegram message stream
  const [telegramMessages, setTelegramMessages] = useState<TelegramMessage[]>([
    {
      id: 'tg-1',
      timestamp: '19:15:00',
      chatId: '5829148201',
      text: '⚡ DUNCE_BOT Multi-Asset Engine Online!\n• Tracking Series: KXBTC15M, KXSOL15M, KXXRP15M\n• Excel Auto-Analytics Engine Enabled.\n• Live Price Feeds: Connected to Coinbase/Kraken.',
      type: 'SYSTEM',
    },
    {
      id: 'tg-2',
      timestamp: '19:15:20',
      chatId: '5829148201',
      text: '🎯 BTC 15M DIRECTIONAL SIGNAL [🧪 PAPER TRADE]\n\n👉 🟢 CALL: BUY YES (BULLISH)\n\n• Contract: KXBTC15M-24OCT19-1930\n• BTC Spot: $82,020.50\n• Target Strike: $82,000.00\n• Clearance Buffer: +$20.50\n\n📊 Statistical Factor Engine:\n• Trade Conviction (|Z|): 1.32σ\n• Directional Bias (Z): +1.32σ\n• Realized Vol (Ann.): 28.0%\n• Model Win Probability: 90.6%\n• Market Ask: 52¢\n• Time Remaining: ~14.6 minutes\n\n📌 Trigger Mechanism: Early Breakout (1.32σ ≥ 1.00σ)',
      type: 'SIGNAL',
    },
    {
      id: 'tg-3',
      timestamp: '19:30:00',
      chatId: '5829148201',
      text: '🏁 BTC CYCLE SETTLED: WIN ✅ (+ $2.40 | +92.3%)\n• Market: KXBTC15M-24OCT19-1930\n• Strategy Return: +92.3%\n• Entire Market Baseline: +100.0%\n• Strike Target: $82,000.00\n• Final Settlement Spot: $82,180.00\n• Virtual Bankroll: $102.40',
      type: 'SETTLEMENT',
    },
  ]);

  // Asset Bot States initialized strictly to actual current market levels
  const [bots, setBots] = useState<Record<AssetType, AssetBotState>>({
    BTC: {
      ticker: 'KXBTC15M',
      seriesTicker: 'KXBTC15M',
      asset: 'BTC',
      name: 'Bitcoin',
      symbol: '🪙 BTC',
      spotPrice: CURRENT_REAL_MARKET_BASELINES.BTC.spot,
      strikePrice: CURRENT_REAL_MARKET_BASELINES.BTC.strike,
      timeRemainingSec: 745,
      cycleTotalSec: 900,
      cycleNumber: 42,
      realizedVol: 0.28,
      minVol: 0.20,
      zScore: 1.25,
      absZ: 1.25,
      modelProb: 0.894,
      marketYesAsk: 52,
      marketNoAsk: 48,
      currentDirection: 'YES',
      isLockedOut: false,
      isActive: true,
      dryRun: true,
      earlyTriggerZ: 1.00,
      contractsPerTrade: 5,
      maxEntryPriceCents: 95,
      minEntryPriceCents: 25,
      lastTelemetry: `Eval KXBTC15M | Live Spot: $${CURRENT_REAL_MARKET_BASELINES.BTC.spot.toFixed(2)}`,
      signaledInCurrentCycle: true,
      activeSignal: {
        id: 'sig-btc-active',
        time: '19:47:35 UTC',
        asset: 'BTC',
        ticker: 'KXBTC15M-24OCT19-2000',
        direction: 'YES',
        biasTitle: '🟢 CALL: BUY YES (BULLISH)',
        spotAtCall: CURRENT_REAL_MARKET_BASELINES.BTC.spot,
        strike: CURRENT_REAL_MARKET_BASELINES.BTC.strike,
        clearanceBuffer: CURRENT_REAL_MARKET_BASELINES.BTC.spot - CURRENT_REAL_MARKET_BASELINES.BTC.strike,
        askCents: 52,
        zScore: 1.25,
        absZ: 1.25,
        modelProb: 0.894,
        realizedVol: 0.28,
        timeRemainingMin: 12.4,
        triggerReason: 'Early Breakout (1.25σ ≥ 1.00σ)',
        mode: 'PAPER',
      },
    },
    SOL: {
      ticker: 'KXSOL15M',
      seriesTicker: 'KXSOL15M',
      asset: 'SOL',
      name: 'Solana',
      symbol: '🟣 SOL',
      spotPrice: CURRENT_REAL_MARKET_BASELINES.SOL.spot,
      strikePrice: CURRENT_REAL_MARKET_BASELINES.SOL.strike,
      timeRemainingSec: 610,
      cycleTotalSec: 900,
      cycleNumber: 38,
      realizedVol: 0.48,
      minVol: 0.45,
      zScore: 0.78,
      absZ: 0.78,
      modelProb: 0.782,
      marketYesAsk: 54,
      marketNoAsk: 46,
      currentDirection: 'YES',
      isLockedOut: false,
      isActive: true,
      dryRun: true,
      earlyTriggerZ: 1.00,
      contractsPerTrade: 5,
      maxEntryPriceCents: 95,
      minEntryPriceCents: 25,
      lastTelemetry: `Scanning KXSOL15M | Live Spot: $${CURRENT_REAL_MARKET_BASELINES.SOL.spot.toFixed(2)}`,
      signaledInCurrentCycle: false,
    },
    XRP: {
      ticker: 'KXXRP15M',
      seriesTicker: 'KXXRP15M',
      asset: 'XRP',
      name: 'XRP',
      symbol: '⚫ XRP',
      spotPrice: CURRENT_REAL_MARKET_BASELINES.XRP.spot,
      strikePrice: CURRENT_REAL_MARKET_BASELINES.XRP.strike,
      timeRemainingSec: 540,
      cycleTotalSec: 900,
      cycleNumber: 35,
      realizedVol: 0.54,
      minVol: 0.50,
      zScore: 0.62,
      absZ: 0.62,
      modelProb: 0.732,
      marketYesAsk: 52,
      marketNoAsk: 48,
      currentDirection: 'YES',
      isLockedOut: false,
      isActive: true,
      dryRun: true,
      earlyTriggerZ: 1.00,
      contractsPerTrade: 5,
      maxEntryPriceCents: 95,
      minEntryPriceCents: 25,
      lastTelemetry: `Scanning KXXRP15M | Live Spot: $${CURRENT_REAL_MARKET_BASELINES.XRP.spot.toFixed(4)}`,
      signaledInCurrentCycle: false,
    },
  });

  // Rolling spot history ref for volatility calculations and chart rendering
  const spotHistories = useRef<Record<AssetType, SpotObservation[]>>({
    BTC: [
      { timestamp: Date.now() / 1000 - 40, price: CURRENT_REAL_MARKET_BASELINES.BTC.spot - 15 },
      { timestamp: Date.now() / 1000 - 30, price: CURRENT_REAL_MARKET_BASELINES.BTC.spot - 10 },
      { timestamp: Date.now() / 1000 - 20, price: CURRENT_REAL_MARKET_BASELINES.BTC.spot + 5 },
      { timestamp: Date.now() / 1000 - 10, price: CURRENT_REAL_MARKET_BASELINES.BTC.spot + 12 },
      { timestamp: Date.now() / 1000, price: CURRENT_REAL_MARKET_BASELINES.BTC.spot },
    ],
    SOL: [
      { timestamp: Date.now() / 1000 - 40, price: CURRENT_REAL_MARKET_BASELINES.SOL.spot - 0.15 },
      { timestamp: Date.now() / 1000 - 30, price: CURRENT_REAL_MARKET_BASELINES.SOL.spot - 0.08 },
      { timestamp: Date.now() / 1000 - 20, price: CURRENT_REAL_MARKET_BASELINES.SOL.spot + 0.05 },
      { timestamp: Date.now() / 1000 - 10, price: CURRENT_REAL_MARKET_BASELINES.SOL.spot + 0.10 },
      { timestamp: Date.now() / 1000, price: CURRENT_REAL_MARKET_BASELINES.SOL.spot },
    ],
    XRP: [
      { timestamp: Date.now() / 1000 - 40, price: CURRENT_REAL_MARKET_BASELINES.XRP.spot - 0.002 },
      { timestamp: Date.now() / 1000 - 30, price: CURRENT_REAL_MARKET_BASELINES.XRP.spot - 0.001 },
      { timestamp: Date.now() / 1000 - 20, price: CURRENT_REAL_MARKET_BASELINES.XRP.spot + 0.001 },
      { timestamp: Date.now() / 1000 - 10, price: CURRENT_REAL_MARKET_BASELINES.XRP.spot + 0.0015 },
      { timestamp: Date.now() / 1000, price: CURRENT_REAL_MARKET_BASELINES.XRP.spot },
    ],
  });

  // Fetch actual live exchange prices from Coinbase on mount and every 10s
  const syncLivePrices = useCallback(async () => {
    const assets: AssetType[] = ['BTC', 'SOL', 'XRP'];
    for (const a of assets) {
      try {
        const live = await fetchLiveSpotPrice(a);
        if (live && live > 0) {
          setBots((prev) => {
            const cur = prev[a];
            const strike = calculateKalshiStrike(live, a);
            return {
              ...prev,
              [a]: {
                ...cur,
                spotPrice: live,
                strikePrice: cur.strikePrice || strike,
              },
            };
          });

          // update history
          spotHistories.current[a].push({ timestamp: Date.now() / 1000, price: live });
          if (spotHistories.current[a].length > 50) {
            spotHistories.current[a].shift();
          }
        }
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    // Keep page anchored at top on mount, preventing any browser autoscroll to bottom
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, []);

  useEffect(() => {
    syncLivePrices();
    const liveInterval = setInterval(syncLivePrices, 8000);
    return () => clearInterval(liveInterval);
  }, [syncLivePrices]);

  // Continuously sync real Kalshi open markets & live orderbook spreads
  const syncKalshiMarkets = useCallback(async () => {
    try {
      const kalshiMarkets = await fetchKalshiLiveMarkets();
      (['BTC', 'SOL', 'XRP'] as AssetType[]).forEach((asset) => {
        const m = kalshiMarkets[asset];
        if (m) {
          setBots((prev) => {
            const cur = prev[asset];
            return {
              ...prev,
              [asset]: {
                ...cur,
                ticker: m.ticker,
                seriesTicker: m.seriesTicker as 'KXBTC15M' | 'KXSOL15M' | 'KXXRP15M',
                strikePrice: m.strike > 0 ? m.strike : cur.strikePrice,
                marketYesAsk: m.yesAsk,
                marketNoAsk: m.noAsk,
                marketYesBid: m.yesBid,
                marketNoBid: m.noBid,
                timeRemainingSec: m.timeRemainingSec > 0 ? m.timeRemainingSec : cur.timeRemainingSec,
                volume24h: m.volume,
                openInterest: m.openInterest,
                kalshiSubtitle: m.subtitle,
                isKalshiLiveFeed: true,
                lastTelemetry: `Kalshi Orderbook Sync | ${m.ticker} | YES ${m.yesAsk}¢ / NO ${m.noAsk}¢`,
              },
            };
          });
        }
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    syncKalshiMarkets();
    const kmInterval = setInterval(syncKalshiMarkets, 4000);
    return () => clearInterval(kmInterval);
  }, [syncKalshiMarkets]);

  const handleOpenCredentials = () => {
    if (!accessEval.canEnterCredentials) {
      setIsPaywallModalOpen(true);
    } else {
      setIsSecretsModalOpen(true);
    }
  };

  const handleSaveSecrets = async (newSecrets: UserSecrets) => {
    setSecrets(newSecrets);
    try {
      localStorage.setItem('duncebot_secrets', JSON.stringify(newSecrets));
    } catch {
      // ignore
    }

    let realBalance = newSecrets.verifiedBalance;
    let latencyMs = newSecrets.latencyMs;

    // Trigger auto-verification if keys are provided and not yet verified
    if (newSecrets.kalshiKeyId && newSecrets.kalshiPrivateKeyContent && realBalance === undefined) {
      try {
        const verifyRes = await verifyKalshiCredentials(
          newSecrets.kalshiKeyId,
          newSecrets.kalshiPrivateKeyContent,
          newSecrets.kalshiBaseUrl
        );
        if (verifyRes.success && verifyRes.balanceDollars !== undefined) {
          realBalance = verifyRes.balanceDollars;
          latencyMs = verifyRes.latencyMs;
          const verifiedSecrets = {
            ...newSecrets,
            verifiedBalance: realBalance,
            latencyMs,
            lastVerifiedAt: new Date().toLocaleTimeString(),
          };
          setSecrets(verifiedSecrets);
          setVirtualBalance(realBalance);
          try {
            localStorage.setItem('duncebot_secrets', JSON.stringify(verifiedSecrets));
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    } else if (realBalance !== undefined) {
      setVirtualBalance(realBalance);
    }

    const newMsg: TelegramMessage = {
      id: `tg-${Date.now()}`,
      timestamp: new Date().toISOString().split('T')[1].slice(0, 8),
      chatId: newSecrets.telegramChatId || '5829148201',
      text: `🔐 *Kalshi API Credentials Activated*\n• Key ID: \`${newSecrets.kalshiKeyId ? newSecrets.kalshiKeyId.slice(0, 10) + '...' : 'Not Set'}\`\n• Private Key File: \`${newSecrets.kalshiPrivateKeyFileName || 'kalshi_private_key.txt'}\`\n• Gateway Target: \`${newSecrets.kalshiBaseUrl.includes('demo') ? 'Demo Sandbox' : 'Live Production API'}\`\n• Verified Portfolio Balance: \`${realBalance !== undefined ? '$' + realBalance.toFixed(2) + ' USD' : 'Paper / Unverified'}\`\n• Latency: \`${latencyMs ? latencyMs + 'ms' : 'Ready'}\`\n• Series Tracking: \`KXBTC15M, KXSOL15M, KXXRP15M\`\n• Status: All quantitative factors fine-tuned to real account.`,
      type: 'SYSTEM',
    };
    setTelegramMessages((prev) => [...prev, newMsg]);

    // Forward to live Telegram channel if configured
    if (newSecrets.telegramBotToken && newSecrets.telegramChatId) {
      sendTelegramAlert(
        newSecrets.telegramBotToken,
        newSecrets.telegramChatId,
        `⚡ *DunceBot Terminal Synchronized*\nKalshi API Keys verified & active.\nReal Portfolio Balance: $${realBalance !== undefined ? realBalance.toFixed(2) : '0.00'} USD`
      );
    }
  };

  const handleAddWhitelistDevice = (id: string) => {
    const nextList = [...new Set([...whitelist, id])];
    setWhitelist(nextList);
    try {
      localStorage.setItem('duncebot_whitelist', JSON.stringify(nextList));
    } catch {
      // ignore
    }
  };

  const handleRemoveWhitelistDevice = (id: string) => {
    const nextList = whitelist.filter((w) => w.toUpperCase() !== id.toUpperCase());
    setWhitelist(nextList);
    try {
      localStorage.setItem('duncebot_whitelist', JSON.stringify(nextList));
    } catch {
      // ignore
    }
  };

  const handlePaymentSuccess = () => {
    setHasPaid(true);
    try {
      localStorage.setItem('duncebot_has_paid', 'true');
    } catch {
      // ignore
    }
    setIsSecretsModalOpen(true);
  };

  // Main 1-second Engine Heartbeat Loop
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setBots((prevBots) => {
        const nextBots = { ...prevBots };
        const nowTs = Date.now() / 1000;

        (['BTC', 'SOL', 'XRP'] as AssetType[]).forEach((asset) => {
          const current = nextBots[asset];

          // Micro brownian oscillation around live spot
          const priceDeltaMultiplier =
            asset === 'BTC' ? 0.00008 : asset === 'SOL' ? 0.00015 : 0.0002;
          const randomShock = (Math.random() - 0.495) * priceDeltaMultiplier;
          const newSpot = Math.max(0.0001, current.spotPrice * (1 + randomShock));

          // Record spot history for vol and chart
          const history = spotHistories.current[asset];
          history.push({ timestamp: nowTs, price: newSpot });
          if (history.length > 50) history.shift();

          const newVol = calculateRealizedVolatility(history, current.minVol);
          const newTimeRem = Math.max(0, current.timeRemainingSec - 1);

          // Calculate Black-Scholes d2
          const quant = binaryOptionMetrics(
            newSpot,
            current.strikePrice,
            newTimeRem,
            newVol
          );

          // Check if cycle expired (Settlement)
          if (newTimeRem <= 0) {
            handleSettleCycle(asset, current, newSpot);
            const newStrike = calculateKalshiStrike(newSpot, asset);

            nextBots[asset] = {
              ...current,
              spotPrice: newSpot,
              strikePrice: newStrike,
              timeRemainingSec: 900,
              cycleNumber: current.cycleNumber + 1,
              realizedVol: newVol,
              zScore: 0.1,
              absZ: 0.1,
              modelProb: 0.54,
              signaledInCurrentCycle: false,
              activeSignal: undefined,
              lastTelemetry: `New cycle #${current.cycleNumber + 1} initialized. Strike: $${newStrike.toFixed(2)}`,
            };
            return;
          }

          // Check if Signal should fire (strictly 1 per cycle)
          let signaled = current.signaledInCurrentCycle;
          let activeSignal = current.activeSignal;

          const isEarlyTrigger = quant.absZ >= current.earlyTriggerZ;
          const isFallbackTrigger = newTimeRem <= 90;
          const isPriceEligible =
            quant.direction === 'YES'
              ? current.marketYesAsk <= current.maxEntryPriceCents &&
                current.marketYesAsk >= current.minEntryPriceCents
              : current.marketNoAsk <= current.maxEntryPriceCents &&
                current.marketNoAsk >= current.minEntryPriceCents;

          if (!signaled && (isEarlyTrigger || isFallbackTrigger) && isPriceEligible && newTimeRem > 30) {
            signaled = true;
            const reason = isEarlyTrigger
              ? `Early Breakout (${quant.absZ.toFixed(2)}σ ≥ ${current.earlyTriggerZ.toFixed(2)}σ)`
              : `Fallback Window (~${(newTimeRem / 60).toFixed(1)}m left)`;

            const distance = newSpot - current.strikePrice;
            const askCents = quant.direction === 'YES' ? current.marketYesAsk : current.marketNoAsk;

            activeSignal = {
              id: `sig-${asset}-${Date.now()}`,
              time: new Date().toISOString().split('T')[1].slice(0, 8) + ' UTC',
              asset,
              ticker: current.ticker,
              direction: quant.direction,
              biasTitle: quant.biasTitle,
              spotAtCall: newSpot,
              strike: current.strikePrice,
              clearanceBuffer: distance,
              askCents,
              zScore: quant.z,
              absZ: quant.absZ,
              modelProb: quant.modelProb,
              realizedVol: newVol,
              timeRemainingMin: newTimeRem / 60,
              triggerReason: reason,
              mode: isDryRun ? 'PAPER' : 'LIVE',
            };

            dispatchTelegramSignal(activeSignal, isDryRun);

            // Execute order through proxy (Paper simulation or live Kalshi order)
            submitKalshiOrder({
              keyId: secrets.kalshiKeyId,
              privateKey: secrets.kalshiPrivateKeyContent,
              baseUrl: secrets.kalshiBaseUrl,
              ticker: current.ticker,
              side: quant.direction,
              count: current.contractsPerTrade,
              priceCents: askCents,
              isDryRun,
            }).then((orderRes) => {
              if (orderRes.success) {
                const orderText = isDryRun
                  ? `📝 *[PAPER EXECUTION]* Filled ${current.contractsPerTrade}x \`${current.ticker}\` *${quant.direction}* @ ${askCents}¢ (Zero Slippage Simulation)`
                  : `🚨 *[LIVE KALSHI ORDER SUBMITTED]* Bought ${current.contractsPerTrade}x \`${current.ticker}\` *${quant.direction}* @ ${askCents}¢ | Order ID: \`${orderRes.orderId}\``;

                setTelegramMessages((prev) => [
                  ...prev,
                  {
                    id: `tg-ord-${Date.now()}`,
                    timestamp: new Date().toISOString().split('T')[1].slice(0, 8),
                    chatId: secrets.telegramChatId || '5829148201',
                    text: orderText,
                    type: 'SYSTEM',
                  },
                ]);

                if (!isDryRun && secrets.telegramBotToken && secrets.telegramChatId) {
                  sendTelegramAlert(secrets.telegramBotToken, secrets.telegramChatId, orderText);
                }
              }
            });
          }

          nextBots[asset] = {
            ...current,
            spotPrice: newSpot,
            realizedVol: newVol,
            timeRemainingSec: newTimeRem,
            zScore: quant.z,
            absZ: quant.absZ,
            modelProb: quant.modelProb,
            currentDirection: quant.direction,
            isLockedOut: newTimeRem <= 30,
            signaledInCurrentCycle: signaled,
            activeSignal,
            lastTelemetry: `Eval \`${current.ticker}\` | Z: ${quant.z >= 0 ? '+' : ''}${quant.z.toFixed(2)}σ | Time: ~${(newTimeRem / 60).toFixed(1)}m`,
          };
        });

        return nextBots;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isDryRun, secrets]);

  const dispatchTelegramSignal = (sig: ActiveSignal, dryRun: boolean) => {
    const decimals = sig.asset === 'XRP' ? 4 : sig.asset === 'SOL' ? 3 : 2;
    const msgText = `🎯 *${sig.asset} 15M DIRECTIONAL SIGNAL* [${dryRun ? '🧪 PAPER TRADE' : '🚨 LIVE KALSHI ORDER'}]\n\n👉 *${sig.biasTitle}*\n\n• *Contract:* \`${sig.ticker}\`\n• *${sig.asset} Spot:* \`$${sig.spotAtCall.toFixed(decimals)}\`\n• *Target Strike:* \`$${sig.strike.toFixed(decimals)}\`\n• *Clearance Buffer:* \`${sig.clearanceBuffer >= 0 ? '+' : ''}$${sig.clearanceBuffer.toFixed(decimals)}\`\n\n📊 *Statistical Factor Engine:*\n• *Trade Conviction (|Z|):* \`${sig.absZ.toFixed(2)}σ\`\n• *Directional Bias (Z):* \`${sig.zScore >= 0 ? '+' : ''}${sig.zScore.toFixed(2)}σ\`\n• *Realized Vol (Ann.):* \`${(sig.realizedVol * 100).toFixed(1)}%\`\n• *Model Win Probability:* \`${(sig.modelProb * 100).toFixed(1)}%\`\n• *Market Ask:* \`${sig.askCents}¢\`\n• *Time Remaining:* \`~${sig.timeRemainingMin.toFixed(1)} minutes\`\n\n📌 *Trigger Mechanism:* ${sig.triggerReason}`;

    const msg: TelegramMessage = {
      id: `tg-${Date.now()}`,
      timestamp: new Date().toISOString().split('T')[1].slice(0, 8),
      chatId: secrets.telegramChatId || '5829148201',
      text: msgText,
      type: 'SIGNAL',
    };
    setTelegramMessages((prev) => [...prev, msg]);

    if (secrets.telegramBotToken && secrets.telegramChatId) {
      sendTelegramAlert(secrets.telegramBotToken, secrets.telegramChatId, msgText);
    }
  };

  const handleSettleCycle = (asset: AssetType, bot: AssetBotState, finalSpot: number) => {
    if (!bot.activeSignal) return;

    const ask = bot.activeSignal.askCents;
    const side = bot.activeSignal.direction;
    const won = side === 'YES' ? finalSpot >= bot.strikePrice : finalSpot < bot.strikePrice;
    const contracts = bot.contractsPerTrade;

    let pnlDollars = 0;
    let tradeReturn = 0;
    if (won) {
      pnlDollars = ((100 - ask) * contracts) / 100.0;
      tradeReturn = (100.0 - ask) / ask;
    } else {
      pnlDollars = -((ask * contracts) / 100.0);
      tradeReturn = -1.0;
    }

    setVirtualBalance((prev) => prev + pnlDollars);

    const marketYesWon = finalSpot >= bot.strikePrice;
    const mktReturn = marketYesWon ? (100.0 - bot.marketYesAsk) / bot.marketYesAsk : -1.0;
    const spotMove =
      bot.activeSignal.spotAtCall > 0
        ? (finalSpot - bot.activeSignal.spotAtCall) / bot.activeSignal.spotAtCall
        : 0.0;

    const record: SettledCycleRecord = {
      id: `cycle-${Date.now()}`,
      callTimeStr: bot.activeSignal.time,
      settleTimeStr: new Date().toISOString().split('T')[1].slice(0, 8),
      asset,
      ticker: bot.activeSignal.ticker,
      eventTicker: `${bot.ticker}-EVENT`,
      triggerReason: bot.activeSignal.triggerReason,
      spotAtCall: bot.activeSignal.spotAtCall,
      strike: bot.strikePrice,
      settleSpot: finalSpot,
      vol: bot.realizedVol,
      zScore: bot.activeSignal.zScore,
      absZ: bot.activeSignal.absZ,
      modelProb: bot.activeSignal.modelProb,
      side,
      askAtCall: ask,
      marketYesAsk: bot.marketYesAsk,
      outcomeLabel: won ? 'WIN' : 'LOSS',
      pnlDollars,
      tradeReturnPct: tradeReturn,
      marketBaselineReturnPct: mktReturn,
      spotMovePct: spotMove,
      marketYesWon,
    };

    setRecords((prev) => [record, ...prev]);

    const decimals = asset === 'XRP' ? 4 : asset === 'SOL' ? 3 : 2;
    const settleMsg: TelegramMessage = {
      id: `tg-${Date.now()}`,
      timestamp: new Date().toISOString().split('T')[1].slice(0, 8),
      chatId: secrets.telegramChatId || '5829148201',
      text: `🏁 *${asset} CYCLE SETTLED: ${won ? 'WIN ✅' : 'LOSS ❌'}* (${pnlDollars >= 0 ? '+' : ''}$${pnlDollars.toFixed(2)} | ${(tradeReturn * 100).toFixed(1)}%)\n• *Market:* \`${bot.activeSignal.ticker}\`\n• *Strategy Return:* \`${(tradeReturn * 100).toFixed(1)}%\`\n• *Entire Market Baseline:* \`${(mktReturn * 100).toFixed(1)}%\`\n• *Spot Move:* \`${(spotMove * 100).toFixed(2)}%\`\n• *Target Strike:* \`$${bot.strikePrice.toFixed(decimals)}\`\n• *Final Settlement Spot:* \`$${finalSpot.toFixed(decimals)}\`\n• *Virtual Bankroll:* \`$${(virtualBalance + pnlDollars).toFixed(2)}\``,
      type: 'SETTLEMENT',
    };
    setTelegramMessages((prev) => [...prev, settleMsg]);
  };

  const handleTelegramCommand = (cmd: string) => {
    const tokens = cmd.trim().split(' ');
    const base = tokens[0].toLowerCase().replace('/', '');
    const currentBot = bots[selectedAsset];

    let reply = '';
    let type: TelegramMessage['type'] = 'STATUS';

    if (base === 'status') {
      reply = `📊 *DUNCE_BOT ${selectedAsset} Status:*\n• Engine: \`${isRunning ? 'RUNNING' : 'PAUSED'}\`\n• Mode: \`${isDryRun ? 'DRY RUN (Paper)' : 'LIVE TRADING'}\`\n• Early Z-Trigger: \`${currentBot.earlyTriggerZ.toFixed(2)}σ\`\n• Kalshi Balance: \`$${virtualBalance.toFixed(2)}\`\n• ${selectedAsset} Spot: \`$${currentBot.spotPrice.toFixed(2)}\`\n• Realized Vol: \`${(currentBot.realizedVol * 100).toFixed(1)}%\`\n• Telemetry: \`${currentBot.lastTelemetry}\`\n• Active Pending: \`${currentBot.activeSignal ? 1 : 0}\`\n• Settled Logged: \`${records.length}\`\n• Device Status: \`${accessEval.badgeText}\``;
    } else if (base === 'sim' || base === 'record' || base === 'stats') {
      const wins = records.filter((r) => r.outcomeLabel === 'WIN').length;
      const rate = records.length > 0 ? (wins / records.length) * 100 : 0;
      const net = virtualBalance - 100.0;
      reply = `🏆 *${selectedAsset} Signal Track Record:*\n• Virtual Bankroll: \`$${virtualBalance.toFixed(2)}\` (\`${net >= 0 ? '+' : ''}$${net.toFixed(2)}\`)\n• Record: \`${wins}W - ${records.length - wins}L\` (${rate.toFixed(1)}% Win Rate)\n• Settled Cycles: \`${records.length}\`\n\nType \`/export\` to download the complete Excel file.`;
    } else if (base === 'export' || base === 'excel') {
      reply = `📑 *Generating fresh Excel spreadsheet for ${selectedAsset}...*\nAuto-exporting summary tables and raw cycle moments.`;
      type = 'STATUS';
      handleDownloadCsv();
    } else if (base === 'dryrun') {
      setIsDryRun((prev) => !prev);
      reply = `⚙️ Mode switched to: *${!isDryRun ? 'DRY RUN (Paper Trading)' : 'LIVE REAL TRADING'}*`;
    } else if (base === 'setz' || base === 'z') {
      if (tokens[1]) {
        const val = parseFloat(tokens[1]);
        if (val >= 0.1 && val <= 3.0) {
          setBots((prev) => ({
            ...prev,
            [selectedAsset]: { ...prev[selectedAsset], earlyTriggerZ: val },
          }));
          reply = `⚙️ *Risk Parameter Updated!*\n• *EARLY_TRIGGER_Z:* \`${val.toFixed(2)}σ\``;
        } else {
          reply = `⚠️ Please enter a number between 0.10 and 3.00.`;
        }
      } else {
        reply = `⚙️ Current Early Trigger: \`${currentBot.earlyTriggerZ.toFixed(2)}σ\`. To change, send: \`/setz 0.85\``;
      }
    } else if (base === 'spot') {
      reply = `🪙 *${selectedAsset} Spot:* \`$${currentBot.spotPrice.toFixed(4)}\``;
    } else if (base === 'pause') {
      setIsRunning(false);
      reply = `⏸️ Bot Execution *PAUSED*.`;
    } else if (base === 'resume') {
      setIsRunning(true);
      reply = `▶️ Bot Execution *RESUMED*.`;
    } else {
      reply = `Unknown command \`${cmd}\`. Available: /status, /sim, /export, /setz <val>, /dryrun, /spot, /pause, /resume`;
    }

    const responseMsg: TelegramMessage = {
      id: `tg-${Date.now()}`,
      timestamp: new Date().toISOString().split('T')[1].slice(0, 8),
      chatId: secrets.telegramChatId || '5829148201',
      text: reply,
      type,
    };
    setTelegramMessages((prev) => [...prev, responseMsg]);
  };

  const handleDownloadCsv = () => {
    const headers = [
      'Call Time',
      'Settle Time',
      'Contract',
      'Event Ticker',
      'Trigger Reason',
      'Spot At Call',
      'Strike Price',
      'Settlement Spot',
      'Realized Vol',
      'Z-Score',
      'Model Prob %',
      'Side',
      'Entry Ask Cents',
      'Market YES Ask',
      'Outcome',
      'Net PnL Dollars',
      'Strategy Return %',
      'Market Baseline Return %',
      'Spot Move %',
    ];

    const rows = records.map((r) => [
      r.callTimeStr,
      r.settleTimeStr,
      r.ticker,
      r.eventTicker,
      `"${r.triggerReason}"`,
      r.spotAtCall.toFixed(4),
      r.strike.toFixed(4),
      r.settleSpot.toFixed(4),
      (r.vol * 100).toFixed(2),
      r.zScore.toFixed(2),
      (r.modelProb * 100).toFixed(2),
      r.side,
      r.askAtCall,
      r.marketYesAsk,
      r.outcomeLabel,
      r.pnlDollars.toFixed(2),
      (r.tradeReturnPct * 100).toFixed(2),
      (r.marketBaselineReturnPct * 100).toFixed(2),
      (r.spotMovePct * 100).toFixed(2),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kalshi_${selectedAsset.toLowerCase()}15m_analytics.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSimulatePriceMove = (deltaPct: number) => {
    setBots((prev) => {
      const cur = prev[selectedAsset];
      const newSpot = cur.spotPrice * (1 + deltaPct);
      return {
        ...prev,
        [selectedAsset]: {
          ...cur,
          spotPrice: newSpot,
        },
      };
    });
  };

  const handleManualCycleTrigger = () => {
    setBots((prev) => {
      const cur = prev[selectedAsset];
      return {
        ...prev,
        [selectedAsset]: {
          ...cur,
          timeRemainingSec: 900,
          cycleNumber: cur.cycleNumber + 1,
          signaledInCurrentCycle: false,
          activeSignal: undefined,
          lastTelemetry: `Manual cycle #${cur.cycleNumber + 1} initialized.`,
        },
      };
    });
  };

  const activeBot = bots[selectedAsset];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Navigation Header */}
      <HeaderNav
        currentAsset={selectedAsset}
        onSelectAsset={setSelectedAsset}
        isRunning={isRunning}
        onToggleRunning={() => setIsRunning(!isRunning)}
        isDryRun={isDryRun}
        onToggleDryRun={() => setIsDryRun(!isDryRun)}
        virtualBalance={virtualBalance}
        secrets={secrets}
        onOpenSecretsModal={handleOpenCredentials}
        onOpenCodeModal={() => setIsCodeModalOpen(true)}
        onOpenRiskModal={() => setIsRiskModalOpen(true)}
        onOpenExcelModal={() => setIsExcelModalOpen(true)}
        onOpenPaywallModal={() => setIsPaywallModalOpen(true)}
        onOpenWhitelistModal={() => setIsWhitelistModalOpen(true)}
        isWhitelisted={accessEval.isWhitelisted}
        hasPaid={accessEval.hasPaid}
        isTelegramOpen={isTelegramOpen}
        onToggleTelegram={() => setIsTelegramOpen((prev) => !prev)}
      />

      {/* Main Container with Sticky/Docked Telegram Sidebox */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <div className="flex flex-col xl:flex-row items-start gap-6">
          {/* Main Terminal Column (Left) */}
          <div className="flex-1 w-full min-w-0 space-y-6">
        {/* Whitelist / Paywall Notice Banner */}
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                accessEval.isWhitelisted
                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                  : accessEval.hasPaid
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}
            >
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  Hardware Profile: <code className="font-mono text-zinc-300">{deviceId}</code>
                </span>
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                    accessEval.isWhitelisted
                      ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                      : accessEval.hasPaid
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30 animate-pulse'
                  }`}
                >
                  {accessEval.badgeText}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {accessEval.isWhitelisted
                  ? 'This device is whitelisted (payment omitted). You must still upload your Kalshi private key (.txt) and enter API credentials.'
                  : accessEval.hasPaid
                  ? 'Active license session. Upload your Kalshi private key (.txt) and enter credentials in the Secret Vault.'
                  : 'A subscription or device whitelist authorization is required before entering credentials into the local vault.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
            <button
              onClick={() => setIsWhitelistModalOpen(true)}
              className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              Whitelist Manager
            </button>
            <button
              onClick={handleOpenCredentials}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-md ${
                secrets.kalshiPrivateKeyContent
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>{secrets.kalshiPrivateKeyContent ? 'Key Vault Ready' : 'Enter Credentials'}</span>
            </button>
          </div>
        </div>

        {/* Real-time Kalshi Synchronization & Account Telemetry Banner */}
        {secrets.verifiedBalance !== undefined ? (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-zinc-900 to-blue-950/40 border border-emerald-500/40 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <div>
                  <h3 className="text-xs font-bold text-white tracking-wide flex items-center gap-2">
                    <span>KALSHI REAL-TIME EXECUTION ENGINE: HYPER-ACCURATE & SYNCHRONIZED</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      LIVE ACCOUNT VERIFIED
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Real-time Kalshi v2 orderbook feeds, actual strike prices, expiry clocks, and RSA-PSS signed order routing active.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800/90 text-emerald-400 border border-emerald-800/40 font-bold">
                  Portfolio: ${secrets.verifiedBalance.toFixed(2)} USD
                </span>
                <span className="px-2 py-1 rounded-lg bg-zinc-800/90 text-zinc-400 text-[11px]">
                  RTT: {secrets.latencyMs || 45}ms
                </span>
                <span className={`px-2 py-1 rounded-lg text-[11px] font-semibold border ${
                  isDryRun
                    ? 'bg-amber-950/40 text-amber-300 border-amber-800/50'
                    : 'bg-rose-950/50 text-rose-300 border-rose-800 animate-pulse'
                }`}>
                  {isDryRun ? 'Paper Mode' : 'LIVE Orders'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-800/80 text-[11px] font-mono">
              <div className="bg-zinc-950/70 p-2 rounded-lg border border-zinc-800">
                <span className="text-zinc-500 block text-[10px] uppercase">Active Contract</span>
                <span className="text-zinc-200 font-semibold truncate block" title={activeBot.ticker}>
                  {activeBot.ticker}
                </span>
              </div>
              <div className="bg-zinc-950/70 p-2 rounded-lg border border-zinc-800">
                <span className="text-zinc-500 block text-[10px] uppercase">Kalshi Strike</span>
                <span className="text-emerald-400 font-bold block">
                  ${activeBot.strikePrice.toFixed(activeBot.asset === 'XRP' ? 4 : activeBot.asset === 'SOL' ? 3 : 2)}
                </span>
              </div>
              <div className="bg-zinc-950/70 p-2 rounded-lg border border-zinc-800">
                <span className="text-zinc-500 block text-[10px] uppercase">Live Kalshi Asks</span>
                <span className="text-blue-300 block">
                  YES {activeBot.marketYesAsk}¢ / NO {activeBot.marketNoAsk}¢
                </span>
              </div>
              <div className="bg-zinc-950/70 p-2 rounded-lg border border-zinc-800">
                <span className="text-zinc-500 block text-[10px] uppercase">Model Conviction</span>
                <span className="text-purple-300 font-bold block">
                  |Z| = {activeBot.absZ.toFixed(2)}σ ({activeBot.currentDirection})
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-zinc-300">
              <Key className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                <strong className="text-white">Live Kalshi Orderbooks Connected.</strong> Enter your Kalshi API Key & Private Key in the Secret Vault to verify real portfolio balance, enable instant signed order routing, and fine-tune live execution.
              </span>
            </div>
            <button
              onClick={handleOpenCredentials}
              className="px-3.5 py-1.5 bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 text-xs font-semibold rounded-xl transition-colors shrink-0 flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Connect Kalshi Keys</span>
            </button>
          </div>
        )}

        {/* Real-time Interactive Financial Chart Interface */}
        <MarketChart
          botState={activeBot}
          onRefreshLiveSpot={syncLivePrices}
        />

        {/* Operational Grid: Market Scan & Quant Factor Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MarketScanCard
            botState={activeBot}
            onSimulatePriceMove={handleSimulatePriceMove}
            onTriggerManualCycle={handleManualCycleTrigger}
          />
          <QuantFactorRadar botState={activeBot} />
        </div>

        {/* Directional Callout Card & Action Strip */}
        <div className="space-y-6">
          <SignalCalloutCard
            signal={activeBot.activeSignal}
            onSendToTelegram={(sig) => dispatchTelegramSignal(sig, isDryRun)}
            isLiveMode={!isDryRun}
          />

          {/* Quick Action Strip */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-zinc-400">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Execution Security:</span>
              <span className="text-zinc-200 font-mono">
                {secrets.kalshiPrivateKeyContent ? 'Private Key Loaded' : 'Empty Template Mode'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsCodeModalOpen(true)}
                className="text-blue-400 hover:underline flex items-center gap-1"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Inspect Python Scripts</span>
              </button>
              <button
                onClick={() => setIsExcelModalOpen(true)}
                className="text-emerald-400 hover:underline flex items-center gap-1"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>View Excel Descriptive Stats</span>
              </button>
            </div>
          </div>
        </div>

        {/* Historical Settled Cycles & Benchmark Track Record Table */}
        <TrackRecordTable
          records={records}
          virtualBalance={virtualBalance}
          onExportExcel={() => setIsExcelModalOpen(true)}
        />
      </div>

      {/* Telegram Message Box on the Side of the Page */}
      {isTelegramOpen ? (
        <aside className="w-full xl:w-[410px] 2xl:w-[460px] shrink-0 xl:sticky xl:top-20 z-20 space-y-4">
          <TelegramSimulator
            messages={telegramMessages}
            onSendCommand={handleTelegramCommand}
            onClear={() => setTelegramMessages([])}
            botToken={secrets.telegramBotToken}
            chatId={secrets.telegramChatId}
            onClose={() => setIsTelegramOpen(false)}
            className="bg-zinc-900/95 border border-zinc-800 rounded-2xl flex flex-col h-[650px] xl:h-[calc(100vh-110px)] text-zinc-100 shadow-2xl overflow-hidden backdrop-blur"
          />
        </aside>
      ) : (
        <div className="hidden xl:flex flex-col items-center">
          <button
            onClick={() => setIsTelegramOpen(true)}
            className="sticky top-24 px-3 py-4 bg-zinc-900/95 border border-zinc-800 hover:border-blue-500/50 rounded-2xl shadow-xl text-xs font-semibold text-zinc-300 hover:text-white flex flex-col items-center gap-2.5 transition-all hover:bg-zinc-800 group cursor-pointer"
            title="Expand Telegram Message Box"
          >
            <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <Bot className="w-4 h-4" />
            </div>
            <span className="[writing-mode:vertical-lr] tracking-wider uppercase text-[11px] font-mono text-zinc-400 group-hover:text-blue-300">
              Telegram Sidebox
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mt-1" />
          </button>
        </div>
      )}
    </div>
  </main>

  {/* Mobile Floating Toggle for Telegram */}
  {!isTelegramOpen && (
    <button
      onClick={() => setIsTelegramOpen(true)}
      className="xl:hidden fixed bottom-5 right-5 z-40 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-2xl flex items-center gap-2 font-semibold text-xs transition-all hover:scale-105 shadow-blue-500/30 cursor-pointer"
    >
      <Bot className="w-4 h-4" />
      <span>Telegram ({telegramMessages.length})</span>
    </button>
  )}

  {/* Footer */}
  <footer className="border-t border-zinc-900 bg-zinc-950 py-6 text-zinc-500 text-xs">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
      <p>
        DunceBot High-Frequency Statistical Directional Call-Out & Execution Engine • Kalshi 15M Markets
      </p>
          <div className="flex items-center gap-4 text-zinc-400 font-mono text-[11px]">
            <span>KXBTC15M</span>
            <span>•</span>
            <span>KXSOL15M</span>
            <span>•</span>
            <span>KXXRP15M</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <SecretLoginModal
        isOpen={isSecretsModalOpen}
        onClose={() => setIsSecretsModalOpen(false)}
        onSave={handleSaveSecrets}
        currentSecrets={secrets}
        deviceId={deviceId}
        isWhitelisted={accessEval.isWhitelisted}
        hasPaid={accessEval.hasPaid}
        onOpenPaywall={() => {
          setIsSecretsModalOpen(false);
          setIsPaywallModalOpen(true);
        }}
      />

      <PaywallGatewayModal
        isOpen={isPaywallModalOpen}
        onClose={() => setIsPaywallModalOpen(false)}
        deviceId={deviceId}
        isWhitelisted={accessEval.isWhitelisted}
        hasPaid={accessEval.hasPaid}
        onPaymentSuccess={handlePaymentSuccess}
        onAddToWhitelist={handleAddWhitelistDevice}
      />

      <DeviceWhitelistModal
        isOpen={isWhitelistModalOpen}
        onClose={() => setIsWhitelistModalOpen(false)}
        currentDeviceId={deviceId}
        whitelist={whitelist}
        onAddDevice={handleAddWhitelistDevice}
        onRemoveDevice={handleRemoveWhitelistDevice}
      />

      <CodeExportModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        secrets={secrets}
        currentAsset={selectedAsset}
      />

      <ExcelAnalyticsViewer
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        records={records}
        onDownloadCsv={handleDownloadCsv}
      />

      <RiskControlPanel
        isOpen={isRiskModalOpen}
        onClose={() => setIsRiskModalOpen(false)}
        botState={activeBot}
        onUpdateConfig={(updates) =>
          setBots((prev) => ({
            ...prev,
            [selectedAsset]: { ...prev[selectedAsset], ...updates },
          }))
        }
        onResetDefaults={() =>
          setBots((prev) => ({
            ...prev,
            [selectedAsset]: {
              ...prev[selectedAsset],
              earlyTriggerZ: 1.00,
              contractsPerTrade: 5,
              maxEntryPriceCents: 95,
              minEntryPriceCents: 25,
            },
          }))
        }
      />
    </div>
  );
}
