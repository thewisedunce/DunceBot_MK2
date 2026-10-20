import React, { useState } from 'react';
import {
  Shield,
  Lock,
  CreditCard,
  Key,
  CheckCircle2,
  Sparkles,
  Zap,
  Copy,
  Check,
  AlertTriangle,
  X,
  ExternalLink,
  Laptop,
} from 'lucide-react';
import { validateLicenseKey } from '../utils/deviceWhitelist';

interface PaywallGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  isWhitelisted: boolean;
  hasPaid: boolean;
  onPaymentSuccess: () => void;
  onAddToWhitelist: (id: string) => void;
}

export const PaywallGatewayModal: React.FC<PaywallGatewayModalProps> = ({
  isOpen,
  onClose,
  deviceId,
  isWhitelisted,
  hasPaid,
  onPaymentSuccess,
  onAddToWhitelist,
}) => {
  const [licenseInput, setLicenseInput] = useState('');
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [copiedDevice, setCopiedDevice] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'lifetime'>('pro');

  if (!isOpen) return null;

  const handleCopyDeviceId = () => {
    navigator.clipboard.writeText(deviceId);
    setCopiedDevice(true);
    setTimeout(() => setCopiedDevice(false), 2000);
  };

  const handleSimulatePayment = () => {
    setIsProcessingPayment(true);
    setTimeout(() => {
      setIsProcessingPayment(false);
      onPaymentSuccess();
      onClose();
    }, 1200);
  };

  const handleApplyLicense = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateLicenseKey(licenseInput)) {
      setLicenseError(null);
      onPaymentSuccess();
      onClose();
    } else {
      setLicenseError('Invalid license key. Try demo key: DUNCE-PRO-2026');
    }
  };

  const handleWhitelistCurrentDevice = () => {
    onAddToWhitelist(deviceId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-zinc-100 my-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                DunceBot Quant License & Access Gateway
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Terminal authorization required before mounting Kalshi API keys and executing orders
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Device Fingerprint Card */}
        <div className="mt-5 p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5 text-blue-400" />
              Current Hardware Fingerprint
            </span>
            <div className="flex items-center gap-2 font-mono text-sm text-zinc-200">
              <span className="font-bold text-white bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                {deviceId}
              </span>
              <button
                type="button"
                onClick={handleCopyDeviceId}
                className="p-1 text-zinc-400 hover:text-white transition-colors"
                title="Copy Device ID"
              >
                {copiedDevice ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isWhitelisted ? (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Whitelisted (Payment Omitted)
              </span>
            ) : (
              <button
                type="button"
                onClick={handleWhitelistCurrentDevice}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 border border-zinc-700"
                title="Bypass paywall for this specific hardware ID"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Whitelist This Device</span>
              </button>
            )}
          </div>
        </div>

        {/* Whitelist Rule Explanation */}
        <div className="mt-3 p-3 bg-blue-950/30 border border-blue-900/40 rounded-xl text-xs text-blue-200/90 leading-relaxed">
          <strong className="text-blue-300 font-semibold">Whitelist Policy:</strong> Authorized devices are
          exempt from subscription fees. However, to maintain zero-trust security,{' '}
          <span className="underline decoration-blue-400">whitelisted devices must still upload their own Kalshi private key (.txt) and enter their personal credentials</span>.
        </div>

        {/* Pricing / Plan Options */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Pro Monthly */}
          <div
            onClick={() => setSelectedPlan('pro')}
            className={`cursor-pointer p-5 rounded-xl border transition-all ${
              selectedPlan === 'pro'
                ? 'bg-blue-950/20 border-blue-500 ring-1 ring-blue-500/50'
                : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                Pro Execution
              </span>
              <span className="text-lg font-extrabold text-white">$49<span className="text-xs text-zinc-400 font-normal">/mo</span></span>
            </div>
            <p className="text-xs text-zinc-400 mt-2">
              Full algorithmic Kalshi access for 1 active device with real-time volatility triggers and automated Excel exports.
            </p>
            <ul className="mt-3 space-y-1.5 text-[11px] text-zinc-300">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> All 3 Markets (BTC, SOL, XRP)
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Black-Scholes Z-Score Callouts
              </li>
            </ul>
          </div>

          {/* Lifetime License */}
          <div
            onClick={() => setSelectedPlan('lifetime')}
            className={`cursor-pointer p-5 rounded-xl border transition-all ${
              selectedPlan === 'lifetime'
                ? 'bg-indigo-950/20 border-indigo-500 ring-1 ring-indigo-500/50'
                : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                Lifetime Terminal
              </span>
              <span className="text-lg font-extrabold text-white">$249<span className="text-xs text-zinc-400 font-normal"> once</span></span>
            </div>
            <p className="text-xs text-zinc-400 mt-2">
              Perpetual institutional clearance with unlimited device whitelisting and live Python source code updates.
            </p>
            <ul className="mt-3 space-y-1.5 text-[11px] text-zinc-300">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Permanent Multi-Device Access
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Full Python Script Downloads
              </li>
            </ul>
          </div>
        </div>

        {/* Activation Code Input */}
        <form onSubmit={handleApplyLicense} className="mt-5 space-y-2">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
            Have an Activation License Key?
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. DUNCE-PRO-2026 or KALSHI-ALPHA-VIP"
              value={licenseInput}
              onChange={(e) => setLicenseInput(e.target.value)}
              className="flex-1 px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 font-mono uppercase"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Activate Key
            </button>
          </div>
          {licenseError && (
            <p className="text-xs text-rose-400 mt-1">{licenseError}</p>
          )}
        </form>

        {/* Footer Actions */}
        <div className="mt-8 pt-5 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setLicenseInput('DUNCE-PRO-2026')}
            className="text-xs text-blue-400 hover:underline flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Use Demo License: DUNCE-PRO-2026
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSimulatePayment}
              disabled={isProcessingPayment}
              className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              <span>
                {isProcessingPayment
                  ? 'Authorizing License...'
                  : `Unlock Access (${selectedPlan === 'pro' ? '$49' : '$249'})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
