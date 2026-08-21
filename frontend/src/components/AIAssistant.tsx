'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, Bot, User, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { usePortfolio } from '../context/PortfolioContext';
import { apiPost } from '../lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'How risky is my portfolio right now?',
  'What do the quant signals say about this stock?',
  'Explain the Kelly position sizing suggestion',
  'Summarize market sentiment today',
];

// Minimal markdown: bold + bullet lines, keeps the widget dependency-free
function renderContent(text: string) {
  return text.split('\n').map((line, i) => {
    const html = line
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-textPrimary">$1</strong>');
    const isBullet = /^\s*[-*•]\s+/.test(line);
    return (
      <p
        key={i}
        className={clsx('min-h-[0.5em]', isBullet && 'pl-3')}
        dangerouslySetInnerHTML={{ __html: isBullet ? html.replace(/^\s*[-*•]\s+/, '• ') : html }}
      />
    );
  });
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { balance, positions } = usePortfolio();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Symbol on screen (screener page) gives the bot live context
  const activeSymbol = pathname?.startsWith('/screener')
    ? searchParams.get('q') || 'AAPL'
    : undefined;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, open]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const next: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await apiPost<{ reply?: string; error?: string }>('/api/ai-chat', {
        messages: next,
        symbol: activeSymbol,
        portfolio: {
          cash_balance: balance,
          positions: positions.map(p => ({
            symbol: p.symbol,
            shares: p.shares,
            averagePrice: p.averagePrice,
          })),
        },
      });
      setMessages(m => [...m, {
        role: 'assistant',
        content: res.reply || `Sorry, I hit an error: ${res.error || 'unknown error'}`,
      }]);
    } catch {
      setMessages(m => [...m, {
        role: 'assistant',
        content: 'I could not reach the analytics backend. Make sure the Python server is running on port 5000.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Launcher */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3 text-sm font-semibold text-black shadow-glowGreen transition-[filter] duration-150 hover:brightness-110"
            aria-label="Open AI assistant"
          >
            <Sparkles size={16} />
            Flint AI
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-[60] flex h-[600px] max-h-[80vh] w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-borderSubtle bg-bgSecondary/95 shadow-card backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-borderSubtle px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 text-black">
                  <Bot size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-textPrimary">Flint AI</div>
                  <div className="text-[11px] text-textMuted">
                    {activeSymbol ? `Watching ${activeSymbol} · portfolio-aware` : 'Portfolio-aware assistant'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-textSecondary hover:bg-white/5 hover:text-textPrimary transition-colors"
                aria-label="Close AI assistant"
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-textSecondary">
                    Ask me about your positions, risk metrics, quant signals, or market sentiment.
                    I can see your paper portfolio and live platform data.
                  </p>
                  <div className="space-y-2">
                    {SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="block w-full rounded-xl border border-borderSubtle bg-white/[0.03] px-3 py-2 text-left text-xs text-textSecondary hover:border-accentGreen/40 hover:text-textPrimary transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={clsx('flex gap-2.5', m.role === 'user' && 'flex-row-reverse')}>
                  <div className={clsx(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px]',
                    m.role === 'user' ? 'bg-white/10 text-textSecondary' : 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-black'
                  )}>
                    {m.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                  </div>
                  <div className={clsx(
                    'max-w-[85%] space-y-1 rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
                    m.role === 'user'
                      ? 'rounded-tr-sm bg-emerald-400/15 text-textPrimary'
                      : 'rounded-tl-sm bg-white/[0.05] text-textSecondary'
                  )}>
                    {renderContent(m.content)}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-xs text-textMuted">
                  <Loader2 size={14} className="animate-spin" />
                  Analyzing live data…
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-borderSubtle p-3">
              <div className="flex items-center gap-2 rounded-xl border border-borderSubtle bg-white/[0.03] px-3 py-2 focus-within:border-accentGreen/50 transition-colors">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                  placeholder="Ask about your portfolio, a ticker, risk…"
                  className="flex-1 bg-transparent text-sm text-textPrimary placeholder:text-textMuted"
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || loading}
                  className="rounded-lg bg-emerald-400/90 p-1.5 text-black disabled:opacity-30 hover:bg-emerald-300 transition-colors"
                  aria-label="Send message"
                >
                  <Send size={14} />
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-textMuted">
                Educational paper-trading analysis, not financial advice.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
