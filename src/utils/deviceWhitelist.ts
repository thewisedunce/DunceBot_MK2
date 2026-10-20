/**
 * Device Whitelisting & Paywall Access Authorization Engine.
 * Manages device identification, whitelist verification, and credential access gating.
 */

export interface PaywallState {
  hasPaid: boolean;
  licenseKey?: string;
  paymentTimestamp?: number;
}

export interface AccessEvaluation {
  canEnterCredentials: boolean;
  isWhitelisted: boolean;
  hasPaid: boolean;
  reason: 'WHITELISTED_BYPASS' | 'PAID_ACTIVE' | 'PAYMENT_REQUIRED';
  badgeText: string;
}

// Pre-seeded authorized devices (Master Developer & Admin Testing IDs)
export const DEFAULT_WHITELISTED_DEVICES: string[] = [
  'DEV-MASTER-ADMIN-001',
  'DEV-THW-DUNCE-7890',
  'DEV-KALSHI-TEST-9921',
];

/**
 * Generates or retrieves a persistent pseudo-fingerprint for the current device.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'DEV-SERVER-NODE-000';
  }

  try {
    const existing = localStorage.getItem('duncebot_device_id');
    if (existing && existing.startsWith('DEV-')) {
      return existing;
    }

    // Build deterministic seed from browser environment
    const ua = navigator.userAgent || 'unknown';
    const screenStr = `${window.screen?.width || 0}x${window.screen?.height || 0}x${window.screen?.colorDepth || 0}`;
    const cores = navigator.hardwareConcurrency || 4;
    const raw = `${ua}_${screenStr}_${cores}_${Date.now()}`;

    // Simple hash to hex string
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
    const deviceId = `DEV-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${Math.floor(1000 + Math.random() * 9000)}`;

    localStorage.setItem('duncebot_device_id', deviceId);
    return deviceId;
  } catch {
    return 'DEV-FALLBACK-0001';
  }
}

/**
 * Checks if a device ID is in the authorized whitelist.
 */
export function isDeviceWhitelisted(deviceId: string, whitelist: string[]): boolean {
  if (!deviceId) return false;
  const cleanId = deviceId.trim().toUpperCase();
  return whitelist.some((w) => w.trim().toUpperCase() === cleanId);
}

/**
 * Evaluates whether the user can proceed to the credential entry screen.
 * Rules:
 * 1. Whitelisted devices are omitted from payment entirely, BUT STILL must enter their keys!
 * 2. Non-whitelisted devices must complete payment or enter a valid license code.
 */
export function evaluatePaywallAccess(
  deviceId: string,
  whitelist: string[],
  hasPaid: boolean
): AccessEvaluation {
  const whitelisted = isDeviceWhitelisted(deviceId, whitelist);

  if (whitelisted) {
    return {
      canEnterCredentials: true,
      isWhitelisted: true,
      hasPaid: false,
      reason: 'WHITELISTED_BYPASS',
      badgeText: 'Whitelisted Device (Payment Omitted)',
    };
  }

  if (hasPaid) {
    return {
      canEnterCredentials: true,
      isWhitelisted: false,
      hasPaid: true,
      reason: 'PAID_ACTIVE',
      badgeText: 'Subscription Active',
    };
  }

  return {
    canEnterCredentials: false,
    isWhitelisted: false,
    hasPaid: false,
    reason: 'PAYMENT_REQUIRED',
    badgeText: 'Payment Required',
  };
}

/**
 * Validates promotional or enterprise license keys.
 */
export function validateLicenseKey(key: string): boolean {
  const clean = key.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!clean) return false;

  const validKeys = [
    'DUNCE-PRO-2026',
    'KALSHI-ALPHA-VIP',
    'QUANT-INSTITUTIONAL-ACCESS',
    'DUNCE-TESTER-FREE',
  ];

  if (validKeys.includes(clean)) return true;

  // Format: DUNCE-XXXX-XXXX (15 chars)
  if (clean.startsWith('DUNCE-') && clean.length >= 14) {
    return true;
  }

  return false;
}
