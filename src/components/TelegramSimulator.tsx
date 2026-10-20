import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  Terminal,
  FileSpreadsheet,
  Zap,
  CheckCircle2,
  Trash2,
  HelpCircle,
  Sparkles,
  X,
} from 'lucide-react';
import { TelegramMessage } from '../types/bot';

interface TelegramSimulatorProps {
  messages: TelegramMessage[];
  onSendCommand: (cmd: string) => void;
  onClear: () => void;
  botToken?: string;
  chatId?: string;
  onClose?: () => void;
  className?: string;
}

export const TelegramSimulator: React.FC<TelegramSimulatorProps> = ({
  messages,
  onSendCommand,
  onClear,
  botToken,
  chatId,
  onClose,
  className,
}) => {
  const [inputVal, setInputVal] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      // Keep scroll localized to this chat box, avoiding webpage scroll jumping
      const el = scrollContainerRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    onSendCommand(inputVal.trim());
    setInputVal('');
  };

  const quickCommands = [
    { label: '/status', desc: 'Engine & Balance' },
    { label: '/sim', desc: 'Track Record & Alpha' },
    { label: '/export', desc: 'Download Excel' },
    { label: '/setz 0.85', desc: 'Set Z-Barrier' },
    { label: '/dryrun', desc: 'Toggle Paper/Live' },
    { label: '/spot', desc: 'Check Spot Feed' },
  ];

  return (
    <div
      className={
        className ||
        'bg-zinc-900/95 border border-zinc-800 rounded-2xl flex flex-col h-[520px] text-zinc-100 shadow-xl overflow-hidden'
      }
    >
      {/* Top Header */}
      <div className="p-3.5 sm:p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                Telegram Dispatch
              </h4>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                {botToken ? 'Live Bot' : 'Simulator'}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-mono truncate max-w-[170px] sm:max-w-xs">
              Chat: {chatId || '5829148201'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onClear}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Clear message history"
            aria-label="Clear chat messages"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              title="Close sidebox"
              aria-label="Close sidebox"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Action Command Chips */}
      <div className="px-4 py-2 bg-zinc-950/40 border-b border-zinc-800/80 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
        <span className="text-zinc-500 text-[10px] uppercase font-bold shrink-0 mr-1">
          Commands:
        </span>
        {quickCommands.map((cmd) => (
          <button
            key={cmd.label}
            onClick={() => onSendCommand(cmd.label)}
            className="px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white font-mono shrink-0 transition-colors"
            title={cmd.desc}
          >
            {cmd.label}
          </button>
        ))}
      </div>

      {/* Message List */}
      <div
        ref={scrollContainerRef}
        className="flex-1 p-4 overflow-y-auto overscroll-contain space-y-3 font-sans text-xs select-text"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[90%] p-3.5 rounded-xl border leading-relaxed space-y-1 ${
              m.type === 'STATUS'
                ? 'bg-zinc-950/80 border-blue-900/40 text-blue-100'
                : m.type === 'SIGNAL'
                ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-100'
                : m.type === 'SETTLEMENT'
                ? 'bg-indigo-950/40 border-indigo-800/50 text-indigo-100'
                : 'bg-zinc-950/70 border-zinc-800 text-zinc-300'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] text-zinc-500 border-b border-zinc-800/60 pb-1 mb-1 font-mono">
              <span className="flex items-center gap-1 text-blue-400">
                <Bot className="w-3 h-3" /> DUNCE_BOT
              </span>
              <span>{m.timestamp}</span>
            </div>
            <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {/* Command Input Form */}
      <form
        onSubmit={handleSubmit}
        className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Type command (e.g. /status, /sim, /setz 0.85, /export)..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-700/60 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
        <button
          type="submit"
          className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          title="Send command"
          aria-label="Send command"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
