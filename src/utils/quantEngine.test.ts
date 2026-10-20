import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalCdf,
  calculateRealizedVolatility,
  binaryOptionMetrics,
  calculateSettlement,
  computeDescriptiveStats,
  validatePrivateKey,
  generateEnvFile,
} from './quantEngine.ts';

test('normalCdf computes expected normal distribution percentiles', () => {
  // At x = 0, CDF should be exactly 0.50
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-5);

  // At x = 1.0, CDF is ~0.8413447
  assert.ok(Math.abs(normalCdf(1.0) - 0.84134) < 1e-3);

  // At x = -1.0, CDF is ~0.158655
  assert.ok(Math.abs(normalCdf(-1.0) - 0.15865) < 1e-3);

  // Symmetry: N(x) + N(-x) = 1.0
  assert.ok(Math.abs(normalCdf(1.96) + normalCdf(-1.96) - 1.0) < 1e-5);
});

test('calculateRealizedVolatility handles sparse data and computes annualized vol', () => {
  // Less than 5 points returns baseline min_vol
  const sparse = [
    { timestamp: 100, price: 90000 },
    { timestamp: 104, price: 90050 },
  ];
  assert.equal(calculateRealizedVolatility(sparse, 0.20), 0.20);

  // 10 constant prices returns min_vol
  const flat = [
    { timestamp: 100, price: 90000 },
    { timestamp: 104, price: 90000 },
    { timestamp: 108, price: 90000 },
    { timestamp: 112, price: 90000 },
    { timestamp: 116, price: 90000 },
    { timestamp: 120, price: 90000 },
  ];
  assert.equal(calculateRealizedVolatility(flat, 0.20), 0.20);

  // Dynamic returns
  const dynamic = [
    { timestamp: 100, price: 90000 },
    { timestamp: 110, price: 90200 },
    { timestamp: 120, price: 89900 },
    { timestamp: 130, price: 90300 },
    { timestamp: 140, price: 90150 },
    { timestamp: 150, price: 90500 },
  ];
  const vol = calculateRealizedVolatility(dynamic, 0.20);
  assert.ok(vol >= 0.20, 'Volatility should be at least minimum baseline');
});

test('binaryOptionMetrics calculates d2 Z-score and directional call correctly', () => {
  // Spot well above strike in short time -> Z > 0, YES direction, high model probability
  const resBull = binaryOptionMetrics(95000, 94000, 300, 0.30);
  assert.equal(resBull.direction, 'YES');
  assert.ok(resBull.z > 0);
  assert.ok(resBull.modelProb > 0.5);

  // Spot below strike -> Z < 0, NO direction
  const resBear = binaryOptionMetrics(93000, 94000, 300, 0.30);
  assert.equal(resBear.direction, 'NO');
  assert.ok(resBear.z < 0);
  assert.ok(resBear.modelProb > 0.5);
});

test('calculateSettlement computes accurate PnL, return % and market baseline', () => {
  // WIN on YES call with 5 contracts at 40 cents ask
  const winSettlement = calculateSettlement({
    side: 'YES',
    strike: 94000,
    settleSpot: 94250,
    spotAtCall: 94050,
    askAtCall: 40,
    marketYesAsk: 45,
    contracts: 5,
  });

  assert.equal(winSettlement.won, true);
  assert.equal(winSettlement.outcomeLabel, 'WIN');
  // (100 - 40) * 5 / 100 = $3.00 profit
  assert.equal(winSettlement.pnlDollars, 3.0);
  // (100 - 40) / 40 = +150% return
  assert.equal(winSettlement.tradeReturnPct, 1.5);
  // Settle spot > strike so market baseline won: (100 - 45) / 45 = ~1.22
  assert.ok(Math.abs(winSettlement.marketBaselineReturnPct - (55 / 45)) < 1e-4);

  // LOSS on YES call
  const lossSettlement = calculateSettlement({
    side: 'YES',
    strike: 94000,
    settleSpot: 93800,
    spotAtCall: 94050,
    askAtCall: 40,
    contracts: 5,
  });

  assert.equal(lossSettlement.won, false);
  assert.equal(lossSettlement.outcomeLabel, 'LOSS');
  // -(40 * 5) / 100 = -$2.00
  assert.equal(lossSettlement.pnlDollars, -2.0);
  assert.equal(lossSettlement.tradeReturnPct, -1.0);
});

test('computeDescriptiveStats returns correct quant metrics', () => {
  const data = [10, 20, 30, 40, 50];
  const stats = computeDescriptiveStats(data);

  assert.equal(stats.count, 5);
  assert.equal(stats.mean, 30);
  assert.equal(stats.min, 10);
  assert.equal(stats.max, 50);
  assert.equal(stats.median, 30);
});

test('validatePrivateKey identifies valid PEM/RSA/Ed25519 and rejects garbage', () => {
  const validPem = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIKx+1234567890abcdefABCDEF1234567890abcdefABCDEF
-----END PRIVATE KEY-----`;
  assert.equal(validatePrivateKey(validPem).isValid, true);

  const invalid = 'not a key';
  assert.equal(validatePrivateKey(invalid).isValid, false);
});

test('generateEnvFile formats environment variables correctly', () => {
  const envOutput = generateEnvFile({
    kalshiKeyId: 'user_key_123',
    kalshiPrivateKeyContent: 'mock_key',
    kalshiPrivateKeyFileName: 'my_private_key.txt',
    telegramBotToken: '123456:ABC-DEF',
    telegramChatId: '987654321',
  });

  assert.ok(envOutput.includes('KALSHI_API_KEY_ID="user_key_123"'));
  assert.ok(envOutput.includes('KALSHI_PRIVATE_KEY_PATH="./my_private_key.txt"'));
  assert.ok(envOutput.includes('TELEGRAM_BOT_TOKEN="123456:ABC-DEF"'));
  assert.ok(envOutput.includes('TELEGRAM_CHAT_ID="987654321"'));
});
