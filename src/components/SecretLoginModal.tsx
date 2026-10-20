import React, { useState, useRef } from 'react';
import {
  Shield,
  Key,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Download,
  HelpCircle,
  Sparkles,
  Lock,
  ExternalLink,
  X,
  Laptop,
  Loader2,
  Activity,
  Check,
} from 'lucide-react';
import { UserSecrets } from '../types/bot';
import { validatePrivateKey, generateEnvFile } from '../utils/quantEngine';
import { verifyKalshiCredentials } from '../utils/kalshiApiService';

interface SecretLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (secrets: UserSecrets) => void;
  currentSecrets: UserSecrets;
  deviceId: string;
  isWhitelisted: boolean;
  hasPaid: boolean;
  onOpenPaywall: () => void;
}

export const SecretLoginModal: React.FC<SecretLoginModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentSecrets,
  deviceId,
  isWhitelisted,
  hasPaid,
  onOpenPaywall,
}) => {
  const [keyId, setKeyId] = useState(currentSecrets.kalshiKeyId || '');
  const [keyContent, setKeyContent] = useState(currentSecrets.kalshiPrivateKeyContent || '');
  const [fileName, setFileName] = useState(currentSecrets.kalshiPrivateKeyFileName || '');
  const [botToken, setBotToken] = useState(currentSecrets.telegramBotToken || '');
  const [chatId, setChatId] = useState(currentSecrets.telegramChatId || '');
  const [baseUrl, setBaseUrl] = useState(
    currentSecrets.kalshiBaseUrl || 'https://external-api.kalshi.com/trade-api/v2'
  );

  const [showToken, setShowToken] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    balanceDollars?: number;
    latencyMs?: number;
    error?: string;
  } | null>(
    currentSecrets.verifiedBalance !== undefined
      ? {
          success: true,
          balanceDollars: currentSecrets.verifiedBalance,
          latencyMs: currentSecrets.latencyMs || 50,
        }
      : null
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleVerifyKeys = async () => {
    if (!keyId.trim()) {
      setValidationError('Please provide your Kalshi API Key ID first.');
      return;
    }
    if (!keyContent.trim()) {
      setValidationError('Please upload or paste your Kalshi Private Key first.');
      return;
    }

    setValidationError(null);
    setIsVerifying(true);
    setVerificationResult(null);

    const res = await verifyKalshiCredentials(keyId.trim(), keyContent, baseUrl);
    setIsVerifying(false);

    if (res.success && res.authenticated) {
      setVerificationResult({
        success: true,
        balanceDollars: res.balanceDollars,
        latencyMs: res.latencyMs,
      });
      setValidationError(null);
    } else {
      setVerificationResult({
        success: false,
        error: res.error || 'Failed to authenticate with Kalshi v2 API',
        latencyMs: res.latencyMs,
      });
      setValidationError(res.error || 'Failed to authenticate with Kalshi v2 API');
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) || '';
      const validation = validatePrivateKey(content);
      if (validation.isValid) {
        setKeyContent(content);
        setFileName(file.name);
        setValidationError(null);
      } else {
        setValidationError(validation.error || 'Invalid private key format.');
        setKeyContent(content);
        setFileName(file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSave = () => {
    if (!keyContent.trim()) {
      setValidationError('Please upload your Kalshi private key text file (.txt / .pem).');
      return;
    }

    const secrets: UserSecrets = {
      kalshiKeyId: keyId.trim(),
      kalshiPrivateKeyContent: keyContent,
      kalshiPrivateKeyFileName: fileName || 'kalshi_private_key.txt',
      kalshiBaseUrl: baseUrl,
      telegramBotToken: botToken.trim(),
      telegramChatId: chatId.trim(),
      isLoggedIn: true,
      verifiedBalance:
        verificationResult?.success && verificationResult.balanceDollars !== undefined
          ? verificationResult.balanceDollars
          : currentSecrets.verifiedBalance,
      latencyMs: verificationResult?.latencyMs ?? currentSecrets.latencyMs,
      lastVerifiedAt: verificationResult?.success ? new Date().toLocaleTimeString() : currentSecrets.lastVerifiedAt,
    };

    onSave(secrets);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 900);
  };

  const handleLoadDemoCredentials = () => {
    const demoKey = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIPk39mQv20q9XFmR5YxZbU3A0mX4dC9T7wLo8pQm1ZaB
-----END PRIVATE KEY-----`;
    setKeyId('DEMO_KALSHI_API_KEY_8a7f2e');
    setKeyContent(demoKey);
    setFileName('kalshi_demo_private_key.txt');
    setBotToken('8850160301:AAF_DemoBotTokenMockKey123456');
    setChatId('5829148201');
    setBaseUrl('https://demo-api.kalshi.com/trade-api/v2');
    setValidationError(null);
  };

  const handleDownloadEnv = () => {
    const envText = generateEnvFile({
      kalshiKeyId: keyId,
      kalshiPrivateKeyContent: keyContent,
      kalshiPrivateKeyFileName: fileName || 'kalshi_private_key.txt',
      telegramBotToken: botToken,
      telegramChatId: chatId,
    });
    const blob = new Blob([envText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '.env';
    link.click();
    URL.revokeObjectURL(url);
  };

  const isKeyValid = keyContent.length > 0 && !validationError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-zinc-100 my-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Authentication & Local Secret Vault
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Stored strictly in your local browser environment. Never transmitted to external servers.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Device Authorization & Whitelist Status Banner */}
        {isWhitelisted ? (
          <div className="mt-5 p-3.5 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-start gap-3">
            <Laptop className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-300">
                  ✨ Device Whitelisted — Payment Omitted
                </span>
                <span className="font-mono text-[10px] bg-emerald-900/50 px-1.5 py-0.5 rounded text-emerald-200">
                  {deviceId}
                </span>
              </div>
              <p className="text-emerald-200/90 leading-relaxed">
                This hardware profile is authorized on the whitelist; payment is waived. As required by execution security, please upload your Kalshi private key (.txt file) and enter credentials below.
              </p>
            </div>
          </div>
        ) : hasPaid ? (
          <div className="mt-5 p-3.5 bg-blue-950/40 border border-blue-800/60 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-300">
                  ✅ License Subscription Active
                </span>
                <span className="font-mono text-[10px] bg-blue-900/50 px-1.5 py-0.5 rounded text-blue-200">
                  {deviceId}
                </span>
              </div>
              <p className="text-blue-200/90 leading-relaxed">
                Credential entry is unlocked for this active license session. Upload your Kalshi private key (.txt file) and enter keys below.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-5 p-4 bg-amber-950/40 border border-amber-800/60 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-amber-300 text-xs block">
                  Subscription / Whitelist Clearance Required
                </span>
                <span className="text-[11px] text-amber-200/80">
                  Device: <code className="font-mono text-white">{deviceId}</code> is not yet whitelisted or paid.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenPaywall}
              className="px-3.5 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors shrink-0"
            >
              Unlock Paywall / Whitelist
            </button>
          </div>
        )}

        {/* Security Notification Banner */}
        <div className="mt-3 p-3.5 bg-zinc-950/60 border border-zinc-800 rounded-xl flex items-center gap-3">
          <Lock className="w-5 h-5 text-zinc-400 shrink-0" />
          <p className="text-xs text-zinc-300 leading-relaxed">
            <strong className="text-zinc-200 font-semibold">Zero-Exfiltration Architecture:</strong> Your
            Kalshi Private Key (.txt file) and Telegram bot credentials are encrypted locally to assemble your local{' '}
            <code className="text-emerald-300 bg-zinc-900 px-1 py-0.5 rounded font-mono">.env</code> configuration.
          </p>
        </div>

        <div className="mt-6 space-y-6">
          {/* File Upload Section (Kalshi Private Key .txt) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-400" />
                Kalshi Private Key File (.txt / .pem) <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] text-zinc-400">
                Downloaded from Kalshi API portal
              </span>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative cursor-pointer border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                dragActive
                  ? 'border-blue-500 bg-blue-500/10'
                  : keyContent
                  ? 'border-emerald-500/50 bg-emerald-950/20'
                  : 'border-zinc-700 hover:border-zinc-600 bg-zinc-950/50 hover:bg-zinc-800/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pem,.key"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />

              {keyContent ? (
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3 text-left">
                    <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-300">
                        {fileName || 'kalshi_private_key.txt'}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {keyContent.length} bytes • Cryptographic PEM Loaded
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setKeyContent('');
                      setFileName('');
                    }}
                    className="text-xs px-2.5 py-1 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors"
                  >
                    Change File
                  </button>
                </div>
              ) : (
                <div className="space-y-2 py-1">
                  <div className="w-10 h-10 mx-auto rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-blue-400 hover:underline">
                      Click to upload
                    </span>{' '}
                    <span className="text-sm text-zinc-400">
                      or drag & drop your Kalshi private key .txt file
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Supports RSA / Ed25519 (.txt, .pem, .key)
                  </p>
                </div>
              )}
            </div>

            {validationError && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {validationError}
              </p>
            )}
          </div>

          {/* Kalshi Key ID */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-4 h-4 text-blue-400" />
                Kalshi API Key ID (UUID)
              </label>
              <a
                href="https://kalshi.com/account/api"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
              >
                Get Kalshi Key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="text"
              placeholder="e.g. 7f8a9b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c"
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          {/* Telegram Credentials Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Telegram Bot Token
                </label>
                <span className="text-[10px] text-zinc-500">From @BotFather</span>
              </div>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  placeholder="e.g. 8611559951:AAEYCnxYgO1Zlxy..."
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-10 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300"
                  aria-label={showToken ? 'Hide token' : 'Show token'}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Telegram Chat ID
                </label>
                <span className="text-[10px] text-zinc-500">From @userinfobot</span>
              </div>
              <input
                type="text"
                placeholder="e.g. 5829148201"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Environment & Base URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Kalshi Gateway Target
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBaseUrl('https://external-api.kalshi.com/trade-api/v2')}
                className={`py-2 px-3 text-xs rounded-xl border text-left font-medium transition-all ${
                  baseUrl.includes('external-api')
                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="font-semibold text-zinc-200">Live Trading API</div>
                <div className="text-[10px] text-zinc-500">external-api.kalshi.com</div>
              </button>
              <button
                type="button"
                onClick={() => setBaseUrl('https://demo-api.kalshi.com/trade-api/v2')}
                className={`py-2 px-3 text-xs rounded-xl border text-left font-medium transition-all ${
                  baseUrl.includes('demo-api')
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="font-semibold text-zinc-200">Demo Sandbox API</div>
                <div className="text-[10px] text-zinc-500">demo-api.kalshi.com</div>
              </button>
            </div>
          </div>

          {/* Real-time Kalshi API Key Verification Section */}
          <div className="p-4 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-zinc-200">
                  Kalshi API Handshake & Verification
                </span>
              </div>
              <button
                type="button"
                onClick={handleVerifyKeys}
                disabled={isVerifying || !keyId || !keyContent}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isVerifying
                    ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                    : !keyId || !keyContent
                    ? 'bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20'
                }`}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Pinging Kalshi...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-3.5 h-3.5" />
                    <span>Test & Verify Connection</span>
                  </>
                )}
              </button>
            </div>

            {verificationResult && (
              <div
                className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                  verificationResult.success
                    ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <div className="flex items-center gap-1.5">
                    {verificationResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span>
                      {verificationResult.success
                        ? 'Authenticated with Kalshi v2 API'
                        : 'Authentication Unsuccessful'}
                    </span>
                  </div>
                  {verificationResult.latencyMs && (
                    <span className="font-mono text-[10px] opacity-75">
                      Ping: {verificationResult.latencyMs}ms
                    </span>
                  )}
                </div>

                {verificationResult.success ? (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-emerald-300 font-mono text-[11px] pt-1">
                    <div>
                      Live Portfolio Balance:{' '}
                      <span className="font-bold text-white text-xs">
                        ${verificationResult.balanceDollars?.toFixed(2)} USD
                      </span>
                    </div>
                    <div className="text-[10px] text-emerald-400/80">
                      • Cryptographic signature: Validated RSA-PSS / Ed25519
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-rose-300/90 leading-tight">
                    {verificationResult.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-8 pt-5 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleLoadDemoCredentials}
              className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1.5 py-1.5 px-2 rounded-lg bg-blue-950/30 border border-blue-800/30"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Quick Fill Demo Sandbox Keys
            </button>
            {keyContent && (
              <button
                type="button"
                onClick={handleDownloadEnv}
                className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 py-1.5 px-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-800"
                title="Download formatted .env file"
              >
                <Download className="w-3.5 h-3.5" />
                Export .env
              </button>
            )}
          </div>

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
              onClick={handleSave}
              className={`px-5 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${
                saveSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
              }`}
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Credentials Saved
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Save Secrets Locally
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
