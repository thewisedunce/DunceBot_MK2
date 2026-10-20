import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateKalshiStrike,
  CURRENT_REAL_MARKET_BASELINES,
} from './marketDataService.ts';

test('calculateKalshiStrike rounds BTC to nearest standard 250 interval', () => {
  assert.equal(calculateKalshiStrike(82040, 'BTC'), 82000);
  assert.equal(calculateKalshiStrike(82180, 'BTC'), 82250);
  assert.equal(calculateKalshiStrike(82390, 'BTC'), 82500);
});

test('calculateKalshiStrike rounds SOL to nearest standard 1.0 interval', () => {
  assert.equal(calculateKalshiStrike(105.25, 'SOL'), 105.00);
  assert.equal(calculateKalshiStrike(105.65, 'SOL'), 106.00);
});

test('calculateKalshiStrike rounds XRP to nearest 0.01 interval', () => {
  assert.equal(Number(calculateKalshiStrike(1.3045, 'XRP').toFixed(4)), 1.30);
  assert.equal(Number(calculateKalshiStrike(1.3080, 'XRP').toFixed(4)), 1.31);
});

test('CURRENT_REAL_MARKET_BASELINES contains accurate contemporary market levels', () => {
  // BTC in the 80k range
  assert.ok(CURRENT_REAL_MARKET_BASELINES.BTC.spot > 70000 && CURRENT_REAL_MARKET_BASELINES.BTC.spot < 100000);
  // SOL in the 100 range
  assert.ok(CURRENT_REAL_MARKET_BASELINES.SOL.spot > 80 && CURRENT_REAL_MARKET_BASELINES.SOL.spot < 150);
  // XRP in the 1.00-1.50 range
  assert.ok(CURRENT_REAL_MARKET_BASELINES.XRP.spot > 0.8 && CURRENT_REAL_MARKET_BASELINES.XRP.spot < 2.0);
});
