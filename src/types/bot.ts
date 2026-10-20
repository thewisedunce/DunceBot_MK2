export type AssetType = 'BTC' | 'SOL' | 'XRP';

export interface UserSecrets {
  kalshiKeyId: string;
  kalshiPrivateKeyContent: string;
  kalshiPrivateKeyFileName: string;
  kalshiBaseUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  isLoggedIn: boolean;
  verifiedBalance?: number;
  lastVerifiedAt?: string;
  latencyMs?: number;
}

export interface AssetBotState {
  ticker: string;
  seriesTicker: 'KXBTC15M' | 'KXSOL15M' | 'KXXRP15M';
  asset: AssetType;
  name: string;
  symbol: string;
  spotPrice: number;
  strikePrice: number;
  timeRemainingSec: number; // 0 to 900 (15 min)
  cycleTotalSec: number;
  cycleNumber: number;
  realizedVol: number;
  minVol: number;
  zScore: number;
  absZ: number;
  modelProb: number;
  marketYesAsk: number;
  marketNoAsk: number;
  marketYesBid?: number;
  marketNoBid?: number;
  volume24h?: number;
  openInterest?: number;
  kalshiSubtitle?: string;
  isKalshiLiveFeed?: boolean;
  currentDirection: 'YES' | 'NO';
  isLockedOut: boolean;
  isActive: boolean;
  dryRun: boolean;
  earlyTriggerZ: number;
  contractsPerTrade: number;
  maxEntryPriceCents: number;
  minEntryPriceCents: number;
  lastTelemetry: string;
  signaledInCurrentCycle: boolean;
  activeSignal?: ActiveSignal;
}

export interface ActiveSignal {
  id: string;
  time: string;
  asset: AssetType;
  ticker: string;
  direction: 'YES' | 'NO';
  biasTitle: string;
  spotAtCall: number;
  strike: number;
  clearanceBuffer: number;
  askCents: number;
  zScore: number;
  absZ: number;
  modelProb: number;
  realizedVol: number;
  timeRemainingMin: number;
  triggerReason: string;
  mode: 'PAPER' | 'LIVE';
  orderId?: string;
  executionStatus?: string;
}

export interface SettledCycleRecord {
  id: string;
  callTimeStr: string;
  settleTimeStr: string;
  asset: AssetType;
  ticker: string;
  eventTicker: string;
  triggerReason: string;
  spotAtCall: number;
  strike: number;
  settleSpot: number;
  vol: number;
  zScore: number;
  absZ: number;
  modelProb: number;
  side: 'YES' | 'NO';
  askAtCall: number;
  marketYesAsk: number;
  outcomeLabel: 'WIN' | 'LOSS';
  pnlDollars: number;
  tradeReturnPct: number;
  marketBaselineReturnPct: number;
  spotMovePct: number;
  marketYesWon: boolean;
}

export interface TelegramMessage {
  id: string;
  timestamp: string;
  chatId: string;
  text: string;
  type: 'STATUS' | 'SIGNAL' | 'SETTLEMENT' | 'SYSTEM';
}
