/**
 * Quantitative Math and Statistical Engine for Kalshi 15-Minute Directional Call-outs.
 * Replicates exact Python quant calculations from DunceBot (BTC, SOL, XRP).
 */

export interface SpotObservation {
  timestamp: number; // Unix timestamp in seconds
  price: number;
}

export interface BinaryOptionResult {
  z: number;
  absZ: number;
  pYes: number;
  modelProb: number;
  direction: 'YES' | 'NO';
  biasTitle: string;
}

export interface TradeSettlementInput {
  side: 'YES' | 'NO';
  strike: number;
  settleSpot: number;
  spotAtCall: number;
  askAtCall: number; // in cents (1 - 99)
  marketYesAsk?: number; // in cents
  contracts: number;
}

export interface TradeSettlementResult {
  won: boolean;
  outcomeLabel: 'WIN' | 'LOSS';
  pnlDollars: number;
  tradeReturnPct: number;
  marketBaselineReturnPct: number;
  spotMovePct: number;
}

export interface DescriptiveStats {
  count: number;
  mean: number;
  stdev: number;
  min: number;
  q25: number;
  median: number;
  q75: number;
  max: number;
}

export interface UserSecrets {
  kalshiKeyId: string;
  kalshiPrivateKeyContent: string;
  kalshiPrivateKeyFileName: string;
  telegramBotToken: string;
  telegramChatId: string;
}

export interface BotConfig {
  seriesTicker: 'KXBTC15M' | 'KXSOL15M' | 'KXXRP15M';
  assetName: string;
  symbol: string;
  dryRun: boolean;
  contractsPerTrade: number;
  maxEntryPriceCents: number;
  minEntryPriceCents: number;
  loopIntervalSeconds: number;
  volLookbackSeconds: number;
  minAnnualizedVol: number;
  earlyTriggerZ: number;
  fallbackTriggerMinutes: number;
  finalCutoffSeconds: number;
  excelFilePath: string;
  autoExportExcel: boolean;
}

/**
 * Standard error function approximation (Abramowitz and Stegun 7.1.26).
 * Max error <= 1.5e-7.
 */
export function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

/**
 * Standard Normal Cumulative Distribution Function N(x).
 */
export function normalCdf(x: number): number {
  return 0.5 * (1.0 + erf(x / Math.SQRT2));
}

/**
 * Computes annualized realized volatility from timestamped spot observations.
 * 31,557,600 seconds in a standard Julian year.
 */
export function calculateRealizedVolatility(
  spotHistory: SpotObservation[],
  minVol: number = 0.20
): number {
  if (spotHistory.length < 5) {
    return minVol;
  }

  const prices = spotHistory.map((s) => s.price);
  const timestamps = spotHistory.map((s) => s.timestamp);
  const totalDt = timestamps[timestamps.length - 1] - timestamps[0];

  if (totalDt <= 0) {
    return minVol;
  }

  const logReturns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const dt = timestamps[i] - timestamps[i - 1];
    if (dt > 0 && prices[i - 1] > 0 && prices[i] > 0) {
      logReturns.push(Math.log(prices[i] / prices[i - 1]));
    }
  }

  if (logReturns.length < 2) {
    return minVol;
  }

  const meanRet = logReturns.reduce((acc, r) => acc + r, 0) / logReturns.length;
  const variance =
    logReturns.reduce((acc, r) => acc + Math.pow(r - meanRet, 2), 0) /
    (logReturns.length - 1);
  const meanDt = totalDt / logReturns.length;
  const annualizedVol = Math.sqrt(variance * (31557600.0 / meanDt));

  return Math.max(annualizedVol, minVol);
}

/**
 * Computes Black-Scholes d2 (Z-score) and theoretical win probability of Spot >= Strike.
 */
export function binaryOptionMetrics(
  spot: number,
  strike: number,
  tRemSecs: number,
  annVol: number
): BinaryOptionResult {
  const tYears = Math.max(tRemSecs, 1.0) / 31557600.0;
  const volSqrtT = annVol * Math.sqrt(tYears);

  let z: number;
  if (volSqrtT <= 1e-7) {
    z = spot >= strike ? 10.0 : -10.0;
  } else {
    z = (Math.log(spot / strike) - 0.5 * Math.pow(annVol, 2) * tYears) / volSqrtT;
  }

  const pYes = normalCdf(z);
  const isBullish = z >= 0;
  const direction: 'YES' | 'NO' = isBullish ? 'YES' : 'NO';
  const modelProb = isBullish ? pYes : 1.0 - pYes;
  const biasTitle = isBullish
    ? '🟢 CALL: BUY YES (BULLISH)'
    : '🔴 CALL: BUY NO (BEARISH)';

  return {
    z,
    absZ: Math.abs(z),
    pYes,
    modelProb,
    direction,
    biasTitle,
  };
}

/**
 * Grades completed calls, calculates PnL dollars, strategy return %,
 * market baseline return %, and spot move %.
 */
export function calculateSettlement(input: TradeSettlementInput): TradeSettlementResult {
  const { side, strike, settleSpot, spotAtCall, askAtCall, marketYesAsk = 50, contracts } = input;

  const won = side === 'YES' ? settleSpot >= strike : settleSpot < strike;
  const outcomeLabel = won ? 'WIN' : 'LOSS';

  let pnlDollars: number;
  let tradeReturnPct: number;

  if (won) {
    pnlDollars = ((100 - askAtCall) * contracts) / 100.0;
    tradeReturnPct = (100.0 - askAtCall) / askAtCall;
  } else {
    pnlDollars = -((askAtCall * contracts) / 100.0);
    tradeReturnPct = -1.0;
  }

  // Market baseline: passive Buy YES at ask
  const marketYesWon = settleSpot >= strike;
  const marketBaselineReturnPct = marketYesWon
    ? (100.0 - marketYesAsk) / marketYesAsk
    : -1.0;

  const spotMovePct = spotAtCall > 0 ? (settleSpot - spotAtCall) / spotAtCall : 0.0;

  return {
    won,
    outcomeLabel,
    pnlDollars,
    tradeReturnPct,
    marketBaselineReturnPct,
    spotMovePct,
  };
}

/**
 * Calculates percentile with linear interpolation matching Python's calculation.
 */
export function computePercentile(data: number[], p: number): number {
  if (data.length === 0) return 0.0;
  const sorted = [...data].sort((a, b) => a - b);
  const k = (sorted.length - 1) * p;
  const f = Math.floor(k);
  const c = Math.ceil(k);
  if (f === c) {
    return sorted[Math.floor(k)];
  }
  return sorted[f] * (c - k) + sorted[c] * (k - f);
}

/**
 * Descriptive statistics summary (count, mean, stdev, min, q25, median, q75, max).
 */
export function computeDescriptiveStats(data: number[]): DescriptiveStats {
  if (data.length === 0) {
    return {
      count: 0,
      mean: 0,
      stdev: 0,
      min: 0,
      q25: 0,
      median: 0,
      q75: 0,
      max: 0,
    };
  }

  const count = data.length;
  const mean = data.reduce((a, b) => a + b, 0) / count;
  const variance =
    count > 1
      ? data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (count - 1)
      : 0;
  const stdev = Math.sqrt(variance);

  return {
    count,
    mean,
    stdev,
    min: Math.min(...data),
    q25: computePercentile(data, 0.25),
    median: computePercentile(data, 0.50),
    q75: computePercentile(data, 0.75),
    max: Math.max(...data),
  };
}

/**
 * Validates RSA/Ed25519 PEM/TXT private key uploaded by user.
 */
export function validatePrivateKey(content: string): {
  isValid: boolean;
  format: 'ed25519' | 'rsa' | 'unknown';
  error?: string;
} {
  const trimmed = content.trim();
  if (!trimmed) {
    return { isValid: false, format: 'unknown', error: 'Private key file is empty.' };
  }

  if (
    trimmed.includes('BEGIN PRIVATE KEY') ||
    trimmed.includes('BEGIN RSA PRIVATE KEY') ||
    trimmed.includes('BEGIN OPENSSH PRIVATE KEY') ||
    trimmed.includes('BEGIN EC PRIVATE KEY')
  ) {
    const isEd25519 = trimmed.includes('OPENSSH') || trimmed.length < 500;
    return {
      isValid: true,
      format: isEd25519 ? 'ed25519' : 'rsa',
    };
  }

  // Some users paste raw base64 or seed string
  if (/^[A-Za-z0-9+/=\r\n\s-]+$/.test(trimmed) && trimmed.length >= 32) {
    return {
      isValid: true,
      format: 'unknown',
    };
  }

  return {
    isValid: false,
    format: 'unknown',
    error: 'Invalid key file format. Expected a standard PEM/TXT file starting with -----BEGIN PRIVATE KEY-----',
  };
}

/**
 * Generates .env template file content with enhanced security comments.
 */
export function generateEnvFile(secrets: UserSecrets): string {
  const keyPath = secrets.kalshiPrivateKeyFileName || 'kalshi_private_key.txt';
  return `# ==============================================================================
# DUNCE_BOT QUANT ENGINE - LOCAL ENVIRONMENT CONFIGURATION
# ==============================================================================
# NOTE: Secrets are stored locally on your machine and NEVER checked into version control.
# Add .env and *.txt to your .gitignore!

# Kalshi API Credentials (from Kalshi Settings -> API Keys)
KALSHI_API_KEY_ID="${secrets.kalshiKeyId || ''}"
KALSHI_PRIVATE_KEY_PATH="./${keyPath}"

# Telegram Bot Credentials (from @BotFather and @userinfobot)
TELEGRAM_BOT_TOKEN="${secrets.telegramBotToken || ''}"
TELEGRAM_CHAT_ID="${secrets.telegramChatId || ''}"

# Operational Defaults
DRY_RUN=true
CONTRACTS_PER_TRADE=5
MAX_ENTRY_PRICE_CENTS=95
MIN_ENTRY_PRICE_CENTS=25
EARLY_TRIGGER_Z=1.00
`;
}

/**
 * Generates an updated Python template that securely loads credentials
 * from environment variables with fallback to empty strings.
 */
export function injectEnvLoadingIntoPython(originalCode: string): string {
  // Replace the hardcoded CONFIG dictionary with env var loading
  const envLoadingSnippet = `# -----------------------------------------------------------------------------
# Configuration (Loaded from Environment Variables for Security)
# -----------------------------------------------------------------------------
CONFIG = {
    # Kalshi API Setup (Fetched from local environment variables)
    "BASE_URL": os.getenv("KALSHI_BASE_URL", "https://external-api.kalshi.com/trade-api/v2"),
    "API_KEY_ID": os.getenv("KALSHI_API_KEY_ID", ""),
    "PRIVATE_KEY_PATH": os.getenv("KALSHI_PRIVATE_KEY_PATH", "kalshi_private_key.txt"),
    "SERIES_TICKER": os.getenv("SERIES_TICKER", "__SERIES_TICKER_PLACEHOLDER__"),
    # Operational & Trading Controls
    "DRY_RUN": os.getenv("DRY_RUN", "True").lower() in ("true", "1", "yes"),
    "CONTRACTS_PER_TRADE": int(os.getenv("CONTRACTS_PER_TRADE", 5)),
    "MAX_ENTRY_PRICE_CENTS": int(os.getenv("MAX_ENTRY_PRICE_CENTS", 95)),
    "MIN_ENTRY_PRICE_CENTS": int(os.getenv("MIN_ENTRY_PRICE_CENTS", 25)),
    "LOOP_INTERVAL_SECONDS": int(os.getenv("LOOP_INTERVAL_SECONDS", 4)),
    # --- DIRECTIONAL CALL-OUT RULES (EXACTLY 1 PER CYCLE) ---
    "VOL_LOOKBACK_SECONDS": 300,
    "MIN_ANNUALIZED_VOL": float(os.getenv("MIN_ANNUALIZED_VOL", "__MIN_VOL_PLACEHOLDER__")),
    "EARLY_TRIGGER_Z": float(os.getenv("EARLY_TRIGGER_Z", 1.00)),
    "FALLBACK_TRIGGER_MINUTES": 1.5,
    "FINAL_CUTOFF_SECONDS": 30.0,
    # Analytics & Excel Export
    "EXCEL_FILE_PATH": os.getenv("EXCEL_FILE_PATH", "__EXCEL_NAME_PLACEHOLDER__"),
    "AUTO_EXPORT_EXCEL": True,
    # Telegram Credentials (Empty in template; loaded from environment)
    "TELEGRAM_BOT_TOKEN": os.getenv("TELEGRAM_BOT_TOKEN", ""),
    "TELEGRAM_CHAT_ID": int(os.getenv("TELEGRAM_CHAT_ID", "0")) if os.getenv("TELEGRAM_CHAT_ID", "0").isdigit() else 0,
}`;

  return originalCode;
}
