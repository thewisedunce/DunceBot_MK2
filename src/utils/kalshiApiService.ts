/**
 * Kalshi API & Execution Service for DunceBot.
 * Communicates with the backend server proxy to authenticate, fetch real orderbooks,
 * execute orders, and relay real-time Telegram alerts.
 */

import { AssetType } from '../types/bot';

export interface KalshiMarketData {
  ticker: string;
  seriesTicker: string;
  title: string;
  eventTicker: string;
  strike: number;
  yesAsk: number; // in cents
  yesBid: number; // in cents
  noAsk: number;  // in cents
  noBid: number;  // in cents
  closeTime: string;
  openTime: string;
  timeRemainingSec: number;
  openInterest: number;
  volume: number;
  subtitle: string;
  status: string;
}

export interface VerificationResult {
  success: boolean;
  authenticated: boolean;
  balanceCents?: number;
  balanceDollars?: number;
  latencyMs?: number;
  error?: string;
  message?: string;
  status?: number;
}

export interface OrderSubmissionResult {
  success: boolean;
  dryRun: boolean;
  orderId?: string;
  ticker: string;
  side: string;
  count: number;
  priceCents: number;
  status?: string;
  error?: string;
}

/**
 * Fetches real-time live open markets from Kalshi for KXBTC15M, KXSOL15M, and KXXRP15M.
 */
export async function fetchKalshiLiveMarkets(): Promise<Record<AssetType, KalshiMarketData | null>> {
  try {
    const res = await fetch('/api/kalshi/markets');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.markets) {
        return data.markets as Record<AssetType, KalshiMarketData | null>;
      }
    }
  } catch (err) {
    console.warn('[Kalshi Service] Failed to fetch live markets:', err);
  }
  return { BTC: null, SOL: null, XRP: null };
}

/**
 * Verifies Kalshi API Key and Private Key against Kalshi v2 portfolio balance.
 */
export async function verifyKalshiCredentials(
  keyId: string,
  privateKey: string,
  baseUrl?: string
): Promise<VerificationResult> {
  try {
    const res = await fetch('/api/kalshi/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyId,
        privateKey,
        baseUrl: baseUrl || 'https://external-api.kalshi.com/trade-api/v2',
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        authenticated: true,
        balanceCents: data.balanceCents,
        balanceDollars: data.balanceDollars,
        latencyMs: data.latencyMs,
        message: data.message,
      };
    } else {
      return {
        success: false,
        authenticated: false,
        error: data.error || `HTTP ${res.status}: Failed to authenticate with Kalshi`,
        status: data.status || res.status,
        latencyMs: data.latencyMs,
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error verifying Kalshi credentials';
    return {
      success: false,
      authenticated: false,
      error: msg,
    };
  }
}

/**
 * Submits an order either as paper dry-run or live on Kalshi.
 */
export async function submitKalshiOrder(params: {
  keyId?: string;
  privateKey?: string;
  baseUrl?: string;
  ticker: string;
  side: 'YES' | 'NO';
  count: number;
  priceCents: number;
  isDryRun: boolean;
}): Promise<OrderSubmissionResult> {
  try {
    const res = await fetch('/api/kalshi/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        dryRun: !!data.dryRun,
        orderId: data.orderId,
        ticker: data.ticker,
        side: data.side,
        count: data.count,
        priceCents: data.priceCents,
        status: data.status,
      };
    } else {
      return {
        success: false,
        dryRun: params.isDryRun,
        ticker: params.ticker,
        side: params.side,
        count: params.count,
        priceCents: params.priceCents,
        error: data.error || 'Order submission failed',
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network failure during order execution';
    return {
      success: false,
      dryRun: params.isDryRun,
      ticker: params.ticker,
      side: params.side,
      count: params.count,
      priceCents: params.priceCents,
      error: msg,
    };
  }
}

/**
 * Dispatches live signal alert to Telegram bot if credentials are configured.
 */
export async function sendTelegramAlert(
  botToken: string,
  chatId: string,
  text: string
): Promise<boolean> {
  if (!botToken || !chatId) return false;
  try {
    const res = await fetch('/api/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken, chatId, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
