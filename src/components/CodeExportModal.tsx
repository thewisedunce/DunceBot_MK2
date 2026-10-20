import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  Download,
  FileText,
  Key,
  Shield,
  Layers,
  Sparkles,
  X,
  ExternalLink,
} from 'lucide-react';
import { AssetType, UserSecrets } from '../types/bot';
import {
  BTC_RAW_TEMPLATE,
  SOL_RAW_TEMPLATE,
  XRP_RAW_TEMPLATE,
  getCompleteBotPythonCode,
} from '../data/pythonTemplates';
import { generateEnvFile } from '../utils/quantEngine';

interface CodeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  secrets: UserSecrets;
  currentAsset: AssetType;
}

type TabOption = 'BTC' | 'SOL' | 'XRP' | 'ENV' | 'KEY' | 'REQ';

export const CodeExportModal: React.FC<CodeExportModalProps> = ({
  isOpen,
  onClose,
  secrets,
  currentAsset,
}) => {
  const [activeTab, setActiveTab] = useState<TabOption>(currentAsset);
  const [templateMode, setTemplateMode] = useState<'empty' | 'hardened' | 'injected'>('hardened');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const getCode = () => {
    switch (activeTab) {
      case 'BTC':
        return getCompleteBotPythonCode('BTC', secrets, templateMode === 'injected');
      case 'SOL':
        return getCompleteBotPythonCode('SOL', secrets, templateMode === 'injected');
      case 'XRP':
        return getCompleteBotPythonCode('XRP', secrets, templateMode === 'injected');
      case 'ENV':
        return generateEnvFile(secrets);
      case 'KEY':
        return secrets.kalshiPrivateKeyContent || '# No private key uploaded yet.\n# Please upload your kalshi_private_key.txt in the Secret Vault!';
      case 'REQ':
        return `# DunceBot High-Frequency Execution Requirements
requests>=2.31.0
cryptography>=42.0.0
openpyxl>=3.1.2
python-dotenv>=1.0.0
`;
      default:
        return '';
    }
  };

  const codeContent = getCode();
  const fileName =
    activeTab === 'BTC'
      ? 'DUNCE_BOT_BTC_MK4.py'
      : activeTab === 'SOL'
      ? 'DUNCE_BOT_SOL15M.py'
      : activeTab === 'XRP'
      ? 'DUNCE_BOT_XRP15M.py'
      : activeTab === 'ENV'
      ? '.env'
      : activeTab === 'KEY'
      ? secrets.kalshiPrivateKeyFileName || 'kalshi_private_key.txt'
      : 'requirements.txt';

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([codeContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadFullBundle = () => {
    // Download Python script + .env
    handleDownload();
    if (activeTab !== 'ENV') {
      setTimeout(() => {
        const envContent = generateEnvFile(secrets);
        const blob = new Blob([envContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = '.env';
        link.click();
        URL.revokeObjectURL(url);
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-zinc-100 my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Python Template & Environment Vault
              </h2>
              <p className="text-xs text-zinc-400">
                Secrets are kept empty in clean template files and dynamically loaded from local environment variables (.env)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy File'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1.5 shadow-md shadow-blue-600/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {fileName}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <button
              onClick={() => setActiveTab('BTC')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'BTC'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <span>🪙 BTC 15M.py</span>
            </button>
            <button
              onClick={() => setActiveTab('SOL')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'SOL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <span>🟣 SOL 15M.py</span>
            </button>
            <button
              onClick={() => setActiveTab('XRP')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'XRP'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <span>⚫ XRP 15M.py</span>
            </button>
            <button
              onClick={() => setActiveTab('ENV')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'ENV'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>.env Config</span>
            </button>
            <button
              onClick={() => setActiveTab('KEY')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'KEY'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>kalshi_key.txt</span>
            </button>
            <button
              onClick={() => setActiveTab('REQ')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'REQ'
                  ? 'bg-zinc-700 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <span>requirements.txt</span>
            </button>
          </div>

          {/* Mode Switcher for Python Scripts */}
          {(activeTab === 'BTC' || activeTab === 'SOL' || activeTab === 'XRP') && (
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-[11px]">
              <button
                onClick={() => setTemplateMode('hardened')}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  templateMode === 'hardened'
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Loads secrets securely from os.getenv and .env"
              >
                Secure .env Loader
              </button>
              <button
                onClick={() => setTemplateMode('empty')}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  templateMode === 'empty'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Clean template with blank credentials"
              >
                Blank Template
              </button>
              <button
                onClick={() => setTemplateMode('injected')}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  templateMode === 'injected'
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Directly embed your local secrets in CONFIG"
              >
                Injected Preview
              </button>
            </div>
          )}
        </div>

        {/* Code Content Box */}
        <div className="flex-1 overflow-y-auto mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-zinc-300 leading-relaxed relative">
          <pre className="whitespace-pre-wrap">{codeContent}</pre>
        </div>

        {/* Quickstart instructions footer */}
        <div className="mt-4 pt-3 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-200">Local Execution Tip:</span>
            <span>
              Save <code className="text-blue-300 font-mono">.env</code>,{' '}
              <code className="text-emerald-300 font-mono">kalshi_private_key.txt</code>, and the{' '}
              <code className="text-zinc-200 font-mono">.py</code> file in the same directory, then run{' '}
              <code className="text-amber-300 font-mono">python {fileName}</code>.
            </span>
          </div>

          <button
            onClick={handleDownloadFullBundle}
            className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            Download Complete Script + .env Bundle
          </button>
        </div>
      </div>
    </div>
  );
};
