import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '2mb' }));

/**
 * Signs a Kalshi API v2 request using RSA-PSS SHA-256 or Ed25519.
 * Payload to sign: timestamp_ms + method.toUpperCase() + path (without query params)
 */
function signKalshiRequest(
  privateKeyPem: string,
  timestampMs: string,
  method: string,
  requestPath: string
): string {
  const normalizedKey = privateKeyPem.replace(/\r\n/g, '\n').trim();
  const payload = Buffer.from(`${timestampMs}${method.toUpperCase()}${requestPath}`, 'utf-8');

  const keyObj = crypto.createPrivateKey(normalizedKey);

  if (keyObj.asymmetricKeyType === 'ed25519') {
    const signature = crypto.sign(null, payload, keyObj);
    return signature.toString('base64');
  } else {
    const signature = crypto.sign(
      'sha256',
      payload,
      {
        key: keyObj,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      }
    );
    return signature.toString('base64');
  }
}

// -----------------------------------------------------------------------------
// Health Check
// -----------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'DunceBot Kalshi Terminal Proxy',
    timestamp: new Date().toISOString(),
  });
});

// -----------------------------------------------------------------------------
// Kalshi Live 15-Minute Markets (Public / Unauthenticated Fallback)
// -----------------------------------------------------------------------------
interface KalshiMarketRecord {
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

app.get('/api/kalshi/markets', async (_req, res) => {
  const seriesTickers = ['KXBTC15M', 'KXSOL15M', 'KXXRP15M'];
  const marketsByAsset: Record<string, KalshiMarketRecord | null> = {
    BTC: null,
    SOL: null,
    XRP: null,
  };

  try {
    await Promise.all(
      seriesTickers.map(async (series) => {
        const asset = series === 'KXBTC15M' ? 'BTC' : series === 'KXSOL15M' ? 'SOL' : 'XRP';
        try {
          const resp = await fetch(
            `https://external-api.kalshi.com/trade-api/v2/markets?series_ticker=${series}&status=open`,
            {
              headers: { Accept: 'application/json' },
            }
          );

          if (resp.ok) {
            const data = await resp.json();
            const list = data.markets;
            if (Array.isArray(list) && list.length > 0) {
              // Find the market that is currently active or closest to closing
              const nowMs = Date.now();
              const sorted = [...list].sort((a, b) => {
                const diffA = new Date(a.close_time).getTime() - nowMs;
                const diffB = new Date(b.close_time).getTime() - nowMs;
                if (diffA > 0 && diffB > 0) return diffA - diffB;
                return diffB - diffA;
              });

              const active = sorted.find((m) => new Date(m.close_time).getTime() > nowMs) || sorted[0];

              if (active) {
                const closeMs = new Date(active.close_time).getTime();
                const remSec = Math.max(0, Math.floor((closeMs - nowMs) / 1000));

                const yesAskDollars = parseFloat(active.yes_ask_dollars || '0');
                const yesBidDollars = parseFloat(active.yes_bid_dollars || '0');
                const noAskDollars = parseFloat(active.no_ask_dollars || '0');
                const noBidDollars = parseFloat(active.no_bid_dollars || '0');

                // Strike extraction
                let strikeVal = parseFloat(active.floor_strike);
                if (isNaN(strikeVal) || strikeVal <= 0) {
                  const match = (active.yes_sub_title || '').match(/\$([0-9,.]+)/);
                  if (match && match[1]) {
                    strikeVal = parseFloat(match[1].replace(/,/g, ''));
                  }
                }

                marketsByAsset[asset] = {
                  ticker: active.ticker,
                  seriesTicker: series,
                  title: active.title || `${asset} 15M Directional`,
                  eventTicker: active.event_ticker || '',
                  strike: strikeVal || 0,
                  yesAsk: Math.max(1, Math.min(99, Math.round(yesAskDollars * 100))),
                  yesBid: Math.max(1, Math.min(99, Math.round(yesBidDollars * 100))),
                  noAsk: Math.max(1, Math.min(99, Math.round(noAskDollars * 100))),
                  noBid: Math.max(1, Math.min(99, Math.round(noBidDollars * 100))),
                  closeTime: active.close_time,
                  openTime: active.open_time,
                  timeRemainingSec: remSec,
                  openInterest: parseFloat(active.open_interest_fp || '0'),
                  volume: parseFloat(active.volume_fp || '0'),
                  subtitle: active.yes_sub_title || '',
                  status: active.status || 'active',
                };
              }
            }
          }
        } catch (err) {
          console.error(`Failed to fetch Kalshi market for ${series}:`, err);
        }
      })
    );

    res.json({
      success: true,
      timestamp: Date.now(),
      markets: marketsByAsset,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// -----------------------------------------------------------------------------
// Verify Kalshi API Key & Check Portfolio Balance
// -----------------------------------------------------------------------------
app.post('/api/kalshi/verify', async (req, res) => {
  const { keyId, privateKey, baseUrl } = req.body;

  if (!keyId || typeof keyId !== 'string' || !keyId.trim()) {
    return res.status(400).json({ success: false, error: 'API Key ID is required.' });
  }
  if (!privateKey || typeof privateKey !== 'string' || !privateKey.trim()) {
    return res.status(400).json({ success: false, error: 'Private Key content is required.' });
  }

  const cleanBase = (baseUrl || 'https://external-api.kalshi.com/trade-api/v2').trim().replace(/\/+$/, '');
  const endpoint = '/portfolio/balance';
  const urlObj = new URL(`${cleanBase}${endpoint}`);
  const requestPath = urlObj.pathname;
  const ts = Date.now().toString();

  let signature: string;
  try {
    signature = signKalshiRequest(privateKey, ts, 'GET', requestPath);
  } catch (signErr: unknown) {
    const msg = signErr instanceof Error ? signErr.message : 'Cryptographic signing failed';
    return res.status(400).json({
      success: false,
      error: `Private Key Format Error: ${msg}. Make sure to supply a valid RSA-PSS or Ed25519 PEM private key.`,
    });
  }

  const startTime = Date.now();
  try {
    const kalshiRes = await fetch(urlObj.toString(), {
      method: 'GET',
      headers: {
        'KALSHI-ACCESS-KEY': keyId.trim(),
        'KALSHI-ACCESS-TIMESTAMP': ts,
        'KALSHI-ACCESS-SIGNATURE': signature,
        'Content-Type': 'application/json',
      },
    });

    const latencyMs = Date.now() - startTime;
    const data = await kalshiRes.json().catch(() => ({}));

    if (kalshiRes.ok) {
      const balanceCents = typeof data.balance === 'number' ? data.balance : 0;
      return res.json({
        success: true,
        authenticated: true,
        balanceCents,
        balanceDollars: balanceCents / 100,
        latencyMs,
        message: 'Successfully authenticated with Kalshi v2 API',
      });
    } else {
      const errMsg =
        data.error?.message ||
        data.message ||
        data.error ||
        `Kalshi returned HTTP ${kalshiRes.status} (${kalshiRes.statusText})`;
      return res.status(kalshiRes.status).json({
        success: false,
        authenticated: false,
        status: kalshiRes.status,
        error: errMsg,
        latencyMs,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error reaching Kalshi API';
    return res.status(502).json({
      success: false,
      authenticated: false,
      error: message,
    });
  }
});

// -----------------------------------------------------------------------------
// Live / Paper Order Execution Proxy
// -----------------------------------------------------------------------------
app.post('/api/kalshi/order', async (req, res) => {
  const { keyId, privateKey, baseUrl, ticker, side, count, priceCents, isDryRun } = req.body;

  if (isDryRun) {
    return res.json({
      success: true,
      dryRun: true,
      orderId: `paper-ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ticker,
      side,
      count,
      priceCents,
      status: 'FILLED',
      message: 'Dry-run paper trade executed instantaneously with zero slippage.',
    });
  }

  // Live order submission to Kalshi v2
  if (!keyId || !privateKey) {
    return res.status(400).json({
      success: false,
      error: 'Cannot submit live order: Kalshi API Key ID and Private Key are required.',
    });
  }

  const cleanBase = (baseUrl || 'https://external-api.kalshi.com/trade-api/v2').trim().replace(/\/+$/, '');
  const endpoint = '/portfolio/events/orders';
  const urlObj = new URL(`${cleanBase}${endpoint}`);
  const requestPath = urlObj.pathname;
  const ts = Date.now().toString();

  let signature: string;
  try {
    signature = signKalshiRequest(privateKey, ts, 'POST', requestPath);
  } catch (signErr: unknown) {
    const msg = signErr instanceof Error ? signErr.message : 'Signature creation failed';
    return res.status(400).json({ success: false, error: msg });
  }

  const sideClean = (side || 'YES').toLowerCase();
  const priceVal = Math.max(0.01, Math.min(0.99, (priceCents || 50) / 100.0));
  const bookSide = sideClean === 'yes' ? 'bid' : 'ask';
  const normalizedPrice = sideClean === 'yes' ? priceVal : 1.0 - priceVal;

  const payload = {
    ticker,
    client_order_id: crypto.randomUUID(),
    side: bookSide,
    count: `${parseFloat(count || 5).toFixed(2)}`,
    price: `${normalizedPrice.toFixed(4)}`,
    time_in_force: 'good_till_canceled',
    self_trade_prevention_type: 'taker_at_cross',
  };

  try {
    const kalshiRes = await fetch(urlObj.toString(), {
      method: 'POST',
      headers: {
        'KALSHI-ACCESS-KEY': keyId.trim(),
        'KALSHI-ACCESS-TIMESTAMP': ts,
        'KALSHI-ACCESS-SIGNATURE': signature,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await kalshiRes.json().catch(() => ({}));
    if (kalshiRes.ok || kalshiRes.status === 201) {
      return res.json({
        success: true,
        dryRun: false,
        orderId: data.order?.order_id || payload.client_order_id,
        ticker,
        side,
        count,
        priceCents,
        status: data.order?.status || 'PENDING',
        data,
      });
    } else {
      const errMsg =
        data.error?.message ||
        data.message ||
        `Kalshi rejected order with HTTP ${kalshiRes.status}`;
      return res.status(kalshiRes.status).json({
        success: false,
        error: errMsg,
        status: kalshiRes.status,
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reach Kalshi API';
    return res.status(502).json({ success: false, error: msg });
  }
});

// -----------------------------------------------------------------------------
// Live Telegram Alert Forwarder
// -----------------------------------------------------------------------------
app.post('/api/telegram/send', async (req, res) => {
  const { botToken, chatId, text } = req.body;

  if (!botToken || !chatId || !text) {
    return res.status(400).json({
      success: false,
      error: 'botToken, chatId, and text are required.',
    });
  }

  try {
    const tgUrl = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;
    const resp = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text,
        parse_mode: 'Markdown',
      }),
    });

    const data = await resp.json().catch(() => ({}));
    if (resp.ok && data.ok) {
      return res.json({ success: true, messageId: data.result?.message_id });
    } else {
      return res.status(resp.status).json({
        success: false,
        error: data.description || 'Telegram API returned an error',
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reach Telegram API';
    return res.status(502).json({ success: false, error: msg });
  }
});

// -----------------------------------------------------------------------------
// Dev / Production Frontend Middleware
// -----------------------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[DunceBot Server] Running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[DunceBot Server] Fatal startup error:', err);
  process.exit(1);
});
