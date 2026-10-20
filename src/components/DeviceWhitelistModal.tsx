import React, { useState } from 'react';
import {
  Laptop,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Shield,
  Sparkles,
  X,
  AlertCircle,
} from 'lucide-react';

interface DeviceWhitelistModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDeviceId: string;
  whitelist: string[];
  onAddDevice: (id: string) => void;
  onRemoveDevice: (id: string) => void;
}

export const DeviceWhitelistModal: React.FC<DeviceWhitelistModalProps> = ({
  isOpen,
  onClose,
  currentDeviceId,
  whitelist,
  onAddDevice,
  onRemoveDevice,
}) => {
  const [newId, setNewId] = useState('');
  const [copiedCurrent, setCopiedCurrent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyCurrent = () => {
    navigator.clipboard.writeText(currentDeviceId);
    setCopiedCurrent(true);
    setTimeout(() => setCopiedCurrent(false), 2000);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newId.trim().toUpperCase();
    if (!clean) return;

    if (whitelist.map((w) => w.toUpperCase()).includes(clean)) {
      setError('Device ID is already in the whitelist.');
      return;
    }

    onAddDevice(clean);
    setNewId('');
    setError(null);
  };

  const isCurrentWhitelisted = whitelist
    .map((w) => w.toUpperCase())
    .includes(currentDeviceId.toUpperCase());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 text-zinc-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Authorized Device Whitelist
              </h3>
              <p className="text-xs text-zinc-400">
                Whitelisted hardware profiles bypass subscription paywalls but must still enter keys
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

        {/* Current Device Status Banner */}
        <div className="mt-5 p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            <span>This Device</span>
            {isCurrentWhitelisted ? (
              <span className="text-emerald-400 flex items-center gap-1 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Whitelisted (Fee Waived)
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1 font-bold">
                <AlertCircle className="w-3.5 h-3.5" /> Not Whitelisted (Paywall Applies)
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 font-mono text-xs">
            <span className="text-white font-bold bg-zinc-900 px-2.5 py-1 rounded border border-zinc-800">
              {currentDeviceId}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyCurrent}
                className="px-2 py-1 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded transition-colors flex items-center gap-1"
              >
                {copiedCurrent ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCurrent ? 'Copied' : 'Copy'}</span>
              </button>

              {!isCurrentWhitelisted && (
                <button
                  type="button"
                  onClick={() => onAddDevice(currentDeviceId)}
                  className="px-2.5 py-1 text-xs font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 hover:bg-emerald-900/40 rounded transition-colors"
                >
                  Whitelist This Device
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Add Device Input */}
        <form onSubmit={handleAdd} className="mt-5 space-y-2">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
            Add Device Fingerprint to Whitelist
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. DEV-8A7F-2B91-4402"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              className="flex-1 px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 font-mono uppercase"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>
          {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
        </form>

        {/* Whitelisted Devices List */}
        <div className="mt-5 space-y-2">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
            Whitelisted Hardware Profiles ({whitelist.length})
          </label>
          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
            {whitelist.map((id) => {
              const isSelf = id.toUpperCase() === currentDeviceId.toUpperCase();
              return (
                <div
                  key={id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono transition-colors ${
                    isSelf
                      ? 'bg-blue-950/20 border-blue-800/50 text-blue-200'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Laptop className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{id}</span>
                    {isSelf && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-sans font-medium">
                        Current
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveDevice(id)}
                    className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                    title="Remove from whitelist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
