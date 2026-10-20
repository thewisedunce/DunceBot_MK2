import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDeviceWhitelisted,
  evaluatePaywallAccess,
  validateLicenseKey,
  DEFAULT_WHITELISTED_DEVICES,
} from './deviceWhitelist.ts';

test('isDeviceWhitelisted correctly matches case-insensitive IDs', () => {
  const whitelist = ['DEV-MASTER-001', 'DEV-ALPHA-1234'];

  assert.equal(isDeviceWhitelisted('DEV-MASTER-001', whitelist), true);
  assert.equal(isDeviceWhitelisted('dev-master-001', whitelist), true);
  assert.equal(isDeviceWhitelisted('DEV-ALPHA-1234', whitelist), true);
  assert.equal(isDeviceWhitelisted('DEV-UNKNOWN-999', whitelist), false);
  assert.equal(isDeviceWhitelisted('', whitelist), false);
});

test('evaluatePaywallAccess waives payment for whitelisted device but requires key entry', () => {
  const whitelist = ['DEV-SPECIAL-PHONE'];

  // Whitelisted device, has not paid
  const access = evaluatePaywallAccess('DEV-SPECIAL-PHONE', whitelist, false);
  assert.equal(access.canEnterCredentials, true);
  assert.equal(access.isWhitelisted, true);
  assert.equal(access.reason, 'WHITELISTED_BYPASS');
});

test('evaluatePaywallAccess blocks unwhitelisted unpaid devices', () => {
  const whitelist = ['DEV-SPECIAL-PHONE'];

  // Unwhitelisted device, has not paid
  const access = evaluatePaywallAccess('DEV-RANDOM-LAPTOP', whitelist, false);
  assert.equal(access.canEnterCredentials, false);
  assert.equal(access.isWhitelisted, false);
  assert.equal(access.reason, 'PAYMENT_REQUIRED');
});

test('evaluatePaywallAccess allows unwhitelisted devices after payment', () => {
  const whitelist = ['DEV-SPECIAL-PHONE'];

  // Unwhitelisted device, has paid
  const access = evaluatePaywallAccess('DEV-RANDOM-LAPTOP', whitelist, true);
  assert.equal(access.canEnterCredentials, true);
  assert.equal(access.isWhitelisted, false);
  assert.equal(access.hasPaid, true);
  assert.equal(access.reason, 'PAID_ACTIVE');
});

test('validateLicenseKey accepts authorized promotional and format-matched keys', () => {
  assert.equal(validateLicenseKey('DUNCE-PRO-2026'), true);
  assert.equal(validateLicenseKey('kalshi-alpha-vip'), true);
  assert.equal(validateLicenseKey('DUNCE-ABCD-1234'), true);
  assert.equal(validateLicenseKey('INVALID-KEY-123'), false);
  assert.equal(validateLicenseKey(''), false);
});
