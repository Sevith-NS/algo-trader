"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Wallet, ShieldAlert, PieChart, History, Scale, RotateCcw,
  TrendingUp, TrendingDown,
} from 'lucide-react';
import clsx from 'clsx';
import Navigation from '../../components/Navigation';
import { usePortfolio } from '../../context/PortfolioContext';
import { API_BASE, apiPost } from '../../lib/api';

const fmt = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const pct = (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;

const SECTOR_COLORS = ['#60A5FA', '#34D399', '#A78BFA', '#FBBF24', '#22D3EE', '#F87171', '#F472B6', '#94A3B8'];

function MetricTile({ label, value, sub, tone }: {
  label: string; value: React.ReactNode; sub?: string; tone?: 'good' | 'bad' | 'warn';
}) {
  return (
    <div className="rounded-xl border border-borderSubtle bg-white/[0.02] p-4">
      <div className="text-[11px] uppercase tracking-wider text-textMuted">{label}</div>
      <div className={clsx(
        'mt-1 text-xl font-bold tabular',
        tone === 'good' && 'text-accentGreen',
        tone === 'bad' && 'text-accentRed',
        tone === 'warn' && 'text-accentAmber',
        !tone && 'text-textPrimary',
      )}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-textMuted">{sub}</div>}
    </div>
  );
}

export default function PortfolioPage() {
  const { balance, positions, trades, resetPortfolio } = usePortfolio();
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [optimization, setOptimization] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Live prices for open positions
  useEffect(() => {
    const fetchPrices = async () => {
      if (positions.length === 0) return;
      const prices: Record<string, number> = {};
      await Promise.all(
        positions.map(async (pos) => {
          try {
            const res = await fetch(`${API_BASE}/api/quote?symbol=${pos.symbol}`);
            const data = await res.json();
            if (data.regularMarketPrice) prices[pos.symbol] = data.regularMarketPrice;
          } catch (e) {
            console.error(e);
          }
        })
      );
      setLivePrices(prices);
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [positions]);

  // Risk analytics + Markowitz optimization
  useEffect(() => {
    if (positions.length === 0) {
      setAnalytics(null);
      setOptimization(null);
      return;
    }
    const run = async () => {
      setLoadingAnalytics(true);
      try {
        const [analyticsRes, optRes] = await Promise.all([
          apiPost('/api/portfolio-analytics', { positions, balance }).catch(() => null),
          positions.length >= 2
            ? apiPost('/api/portfolio-optimization', { symbols: positions.map(p => p.symbol) }).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (analyticsRes && !analyticsRes.error) setAnalytics(analyticsRes);
        if (optRes && !optRes.error) setOptimization(optRes);
      } finally {
        setLoadingAnalytics(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  const { totalValue, invested, dayCostBasis } = useMemo(() => {
    const investedVal = positions.reduce((acc, pos) => {
      const price = livePrices[pos.symbol] || pos.averagePrice;
      return acc + pos.shares * price;
    }, 0);
    const cost = positions.reduce((acc, pos) => acc + pos.shares * pos.averagePrice, 0);
    return { totalValue: balance + investedVal, invested: investedVal, dayCostBasis: cost };
  }, [positions, livePrices, balance]);

  const totalReturn = totalValue - 100000;
  const unrealized = invested - dayCostBasis;
  const risk = analytics?.risk;

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="glass-panel mb-6 flex flex-wrap items-center justify-between gap-6 p-6">
          <div className="flex flex-wrap items-center gap-10">
            <div>
              <div className="flex items-center gap-2 text-sm text-textSecondary">
                <Wallet size={14} /> Total Account Value
              </div>
              <div className="mt-1 text-4xl font-bold tabular text-textPrimary">{fmt(totalValue)}</div>
              <div className={clsx('mt-1 text-sm font-medium tabular', totalReturn >= 0 ? 'text-accentGreen' : 'text-accentRed')}>
                {totalReturn >= 0 ? <TrendingUp size={13} className="mr-1 inline" /> : <TrendingDown size={13} className="mr-1 inline" />}
                {totalReturn >= 0 ? '+' : ''}{fmt(totalReturn)} ({pct((totalReturn / 100000) * 100)}) all time
              </div>
            </div>
            <div className="hidden gap-8 sm:flex">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-textMuted">Cash</div>
                <div className="mt-1 text-lg font-semibold tabular text-textPrimary">{fmt(balance)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-textMuted">Invested</div>
                <div className="mt-1 text-lg font-semibold tabular text-textPrimary">{fmt(invested)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-textMuted">Unrealized P&L</div>
                <div className={clsx('mt-1 text-lg font-semibold tabular', unrealized >= 0 ? 'text-accentGreen' : 'text-accentRed')}>
                  {unrealized >= 0 ? '+' : ''}{fmt(unrealized)}
                </div>
              </div>
            </div>
          </div>
          <button
            className="flex items-center gap-2 rounded-xl border border-red-400/40 px-4 py-2.5 text-sm text-accentRed hover:bg-red-400/10 transition-colors"
            onClick={() => {
              if (confirm('Are you sure you want to reset your portfolio back to $100,000?')) resetPortfolio();
            }}
          >
            <RotateCcw size={14} /> Reset Account
          </button>
        </div>

        {/* Risk analytics strip */}
        {positions.length > 0 && (
          <section className="glass-panel mb-6 p-5" style={{ borderTop: '2px solid #F87171' }}>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-textPrimary">
              <ShieldAlert size={15} className="text-accentRed" /> Risk Analytics
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-textMuted">1y daily · 95% confidence</span>
            </h2>
            {loadingAnalytics && !risk ? (
              <p className="text-sm text-textSecondary">Computing VaR, drawdown and risk-adjusted returns…</p>
            ) : risk ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <MetricTile
                  label="Value at Risk (1d)"
                  value={fmt(risk.var_95_daily_usd)}
                  sub={`${risk.var_95_daily_pct}% of invested`}
                  tone="bad"
                />
                <MetricTile
                  label="Expected Shortfall"
                  value={fmt(risk.cvar_95_daily_usd)}
                  sub={`CVaR ${risk.cvar_95_daily_pct}%`}
                  tone="bad"
                />
                <MetricTile
                  label="Sharpe Ratio"
                  value={risk.sharpe_ratio}
                  sub="risk-adjusted return"
                  tone={risk.sharpe_ratio >= 1 ? 'good' : risk.sharpe_ratio >= 0 ? 'warn' : 'bad'}
                />
                <MetricTile
                  label="Sortino Ratio"
                  value={risk.sortino_ratio}
                  sub="downside-adjusted"
                  tone={risk.sortino_ratio >= 1.5 ? 'good' : risk.sortino_ratio >= 0 ? 'warn' : 'bad'}
                />
                <MetricTile
                  label="Max Drawdown"
                  value={`${risk.max_drawdown_pct}%`}
                  sub={`vol ${risk.annual_volatility_pct}% ann.`}
                  tone={risk.max_drawdown_pct <= -20 ? 'bad' : 'warn'}
                />
                <MetricTile
                  label="Beta vs S&P 500"
                  value={risk.beta_vs_sp500 ?? '—'}
                  sub={`diversification ${risk.diversification_score}/100`}
                />
              </div>
            ) : (
              <p className="text-sm text-textSecondary">
                Risk analytics unavailable — ensure the Python backend is running.
              </p>
            )}
          </section>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          {/* Positions */}
          <div className="space-y-6">
            <div className="glass-panel p-5">
              <h2 className="mb-4 flex items-center gap-2 border-b border-borderSubtle pb-3 text-sm font-semibold text-textPrimary">
                <PieChart size={15} className="text-accentBlue" /> Open Positions
              </h2>
              {positions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-borderSubtle text-left text-[11px] uppercase tracking-wider text-textMuted">
                        <th className="py-2.5 font-medium">Symbol</th>
                        <th className="py-2.5 font-medium">Shares</th>
                        <th className="py-2.5 font-medium">Avg Price</th>
                        <th className="py-2.5 font-medium">Last</th>
                        <th className="py-2.5 font-medium">Value</th>
                        <th className="py-2.5 font-medium">Weight</th>
                        <th className="py-2.5 font-medium">Unrealized P&L</th>
                        <th className="py-2.5 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map(pos => {
                        const currentPrice = livePrices[pos.symbol] || pos.averagePrice;
                        const currentValue = pos.shares * currentPrice;
                        const costBasis = pos.shares * pos.averagePrice;
                        const pnl = currentValue - costBasis;
                        const pnlPercent = (pnl / costBasis) * 100;
                        const weight = invested > 0 ? (currentValue / invested) * 100 : 0;

                        return (
                          <tr key={pos.symbol} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 font-bold text-textPrimary">{pos.symbol}</td>
                            <td className="py-3 tabular">{pos.shares}</td>
                            <td className="py-3 tabular">{fmt(pos.averagePrice)}</td>
                            <td className="py-3 tabular">{livePrices[pos.symbol] ? fmt(currentPrice) : '…'}</td>
                            <td className="py-3 tabular">{fmt(currentValue)}</td>
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/5">
                                  <div className="h-full rounded-full bg-accentBlue" style={{ width: `${Math.min(weight, 100)}%` }} />
                                </div>
                                <span className="text-xs tabular text-textSecondary">{weight.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className={clsx('py-3 tabular font-medium', pnl >= 0 ? 'text-accentGreen' : 'text-accentRed')}>
                              {pnl >= 0 ? '+' : ''}{fmt(pnl)} ({pct(pnlPercent)})
                            </td>
                            <td className="py-3">
                              <Link href={`/screener?q=${pos.symbol}`} className="text-xs font-medium text-accentBlue hover:underline">
                                Trade
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-textSecondary">
                  <p>No open positions.</p>
                  <Link href="/screener" className="mt-2 inline-block text-sm font-medium text-accentGreen hover:underline">
                    Go to the Terminal →
                  </Link>
                </div>
              )}
            </div>

            {/* Sector allocation */}
            {analytics?.sector_allocation && Object.keys(analytics.sector_allocation).length > 0 && (
              <div className="glass-panel p-5">
                <h2 className="mb-4 flex items-center gap-2 border-b border-borderSubtle pb-3 text-sm font-semibold text-textPrimary">
                  <PieChart size={15} className="text-accentPurple" /> Sector Allocation
                </h2>
                <div className="mb-3 flex h-3 w-full overflow-hidden rounded-full">
                  {Object.entries(analytics.sector_allocation).map(([sector, w], i) => (
                    <div
                      key={sector}
                      className="h-full transition-all duration-700"
                      style={{ width: `${(w as number) * 100}%`, background: SECTOR_COLORS[i % SECTOR_COLORS.length] }}
                      title={`${sector}: ${((w as number) * 100).toFixed(1)}%`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  {Object.entries(analytics.sector_allocation).map(([sector, w], i) => (
                    <div key={sector} className="flex items-center gap-1.5 text-xs text-textSecondary">
                      <span className="h-2 w-2 rounded-full" style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                      {sector} <span className="tabular text-textPrimary">{((w as number) * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Side column */}
          <div className="space-y-6">
            {/* Markowitz */}
            <div className="glass-panel p-5" style={{ borderTop: '2px solid #60A5FA' }}>
              <h2 className="mb-4 flex items-center gap-2 border-b border-borderSubtle pb-3 text-sm font-semibold text-textPrimary">
                <Scale size={15} className="text-accentBlue" /> Markowitz Optimization
              </h2>
              {positions.length < 2 ? (
                <p className="text-sm text-textSecondary">Hold at least 2 distinct assets to compute the efficient frontier.</p>
              ) : optimization ? (
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-textSecondary">Exp. Return (annual)</span>
                    <span className="tabular font-medium text-accentGreen">+{(optimization.portfolio_expected_annual_return * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-textSecondary">Volatility</span>
                    <span className="tabular">{(optimization.portfolio_annual_volatility * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-textSecondary">Sharpe Ratio</span>
                    <span className="tabular font-bold">{optimization.portfolio_sharpe_ratio.toFixed(2)}</span>
                  </div>
                  <div className="mt-3 border-t border-borderSubtle pt-3">
                    <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-textMuted">Optimal max-Sharpe weights</h4>
                    {Object.entries(optimization.asset_details).map(([sym, details]: [string, any]) => (
                      <div key={sym} className="flex items-center justify-between py-1 text-xs">
                        <span className="text-textSecondary">{sym} <span className="text-textMuted">(β {details.beta.toFixed(2)})</span></span>
                        <span className="tabular font-medium text-accentGreen">{(details.optimal_weight * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-textSecondary">Calculating efficient frontier…</p>
              )}
            </div>

            {/* Trade history */}
            <div className="glass-panel p-5">
              <h2 className="mb-4 flex items-center gap-2 border-b border-borderSubtle pb-3 text-sm font-semibold text-textPrimary">
                <History size={15} className="text-textSecondary" /> Trade History
              </h2>
              {trades.length > 0 ? (
                <div className="max-h-[400px] space-y-3 overflow-y-auto pr-1">
                  {trades.slice(0, 50).map(trade => (
                    <div key={trade.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={clsx(
                          'rounded px-1.5 py-0.5 text-[11px] font-bold',
                          trade.type === 'BUY' ? 'bg-emerald-400/10 text-accentGreen' : 'bg-red-400/10 text-accentRed'
                        )}>
                          {trade.type}
                        </span>
                        <span className="font-semibold text-textPrimary">{trade.symbol}</span>
                      </div>
                      <div className="text-right">
                        <div className="tabular text-textPrimary">{trade.shares} @ {fmt(trade.price)}</div>
                        <div className="text-[11px] text-textMuted">
                          {new Date(trade.timestamp).toLocaleDateString()} {new Date(trade.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-textSecondary">No trade history yet.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
