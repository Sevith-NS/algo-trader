"use client";
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Crosshair, ShieldAlert, Target, Gauge, BrainCircuit,
  Newspaper, TrendingUp, TrendingDown, Minus, ExternalLink,
} from 'lucide-react';
import clsx from 'clsx';
import Navigation from '../../components/Navigation';
import SearchInput from '../../components/SearchInput';
import Chart from '../../components/Chart';
import { usePortfolio } from '../../context/PortfolioContext';
import { API_BASE } from '../../lib/api';

const fmtUsd = (val: number | undefined | null, currency = 'USD') =>
  val === undefined || val === null
    ? '—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val);

function StatRow({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[13px] text-textSecondary">{label}</span>
      <span className={clsx('text-[13px] font-medium tabular text-textPrimary', valueClass)}>{value}</span>
    </div>
  );
}

function Panel({ title, icon, children, accent }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; accent?: string;
}) {
  return (
    <div className="glass-panel p-5" style={accent ? { borderTop: `2px solid ${accent}` } : undefined}>
      <h3 className="mb-3 flex items-center gap-2 border-b border-borderSubtle pb-3 text-sm font-semibold text-textPrimary">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function FactorBar({ label, value }: { label: string; value: number }) {
  // value in [-1, 1]
  const pct = Math.min(Math.abs(value), 1) * 50;
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-28 shrink-0 text-[11px] capitalize text-textMuted">{label.replace('_', ' ')}</span>
      <div className="relative h-1.5 flex-1 rounded-full bg-white/5">
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
        <div
          className={clsx('absolute top-0 h-full rounded-full', value >= 0 ? 'bg-accentGreen' : 'bg-accentRed')}
          style={value >= 0 ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
        />
      </div>
      <span className={clsx('w-10 text-right text-[11px] tabular', value >= 0 ? 'text-accentGreen' : 'text-accentRed')}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}
      </span>
    </div>
  );
}

function ScreenerContent() {
  const searchParams = useSearchParams();
  const symbol = searchParams.get('q') || 'AAPL';
  const [quote, setQuote] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [mlInsights, setMlInsights] = useState<any>(null);
  const [quantSignals, setQuantSignals] = useState<any>(null);
  const [tickerNews, setTickerNews] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { executeTrade, balance, positions } = usePortfolio();
  const [tradeShares, setTradeShares] = useState(1);
  const [tradeMessage, setTradeMessage] = useState('');

  const heldPosition = positions.find(p => p.symbol === symbol);

  const handleTrade = (type: 'BUY' | 'SELL') => {
    if (!quote?.regularMarketPrice) return;
    const result = executeTrade(symbol, type, tradeShares, quote.regularMarketPrice);
    setTradeMessage(result.message);
    setTimeout(() => setTradeMessage(''), 3000);
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [quoteRes, chartRes, mlRes, quantRes, newsRes] = await Promise.all([
          fetch(`${API_BASE}/api/quote?symbol=${symbol}`),
          fetch(`${API_BASE}/api/chart?symbol=${symbol}&interval=1d`),
          fetch(`${API_BASE}/api/ml-insights?symbol=${symbol}`),
          fetch(`${API_BASE}/api/quant-signals?symbol=${symbol}`),
          fetch(`${API_BASE}/api/news/ticker?symbol=${symbol}`),
        ]);

        const quoteData = await quoteRes.json();
        const chartRaw = await chartRes.json();
        const mlData = await mlRes.json();
        const quantData = await quantRes.json();
        const newsData = await newsRes.json();

        setQuote(quoteData);
        setMlInsights(!mlData.error ? mlData : null);
        setQuantSignals(!quantData.error ? quantData : null);
        setTickerNews(!newsData.error ? newsData : null);

        if (chartRaw && chartRaw.quotes) {
          const formattedData = chartRaw.quotes
            .filter((q: any) => q.close !== null && q.open !== null)
            .map((q: any) => ({
              time: (q.time || (q.date ? new Date(q.date).toISOString().split('T')[0] : null)) as any,
              open: q.open,
              high: q.high,
              low: q.low,
              close: q.close,
            }))
            .filter((q: any) => q.time !== null)
            .sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime())
            .filter((item: any, index: number, self: any[]) =>
              index === self.findIndex((t) => t.time === item.time)
            );
          setChartData(formattedData);
        }
      } catch (err) {
        console.error("Failed to fetch data", err);
      } finally {
        setLoading(false);
      }
    }

    if (symbol) fetchData();
  }, [symbol]);

  const levels = quantSignals?.levels;
  const sizing = quantSignals?.position_sizing;
  const ind = quantSignals?.indicators;
  const isBuy = quantSignals?.action === 'buy';
  const isSell = quantSignals?.action === 'sell';
  const signalColor = isBuy ? '#34D399' : isSell ? '#F87171' : '#FBBF24';

  const suggestedShares = levels && sizing && quote?.regularMarketPrice
    ? Math.floor((balance * sizing.recommended_fraction) / quote.regularMarketPrice)
    : null;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-16 sm:px-6 lg:px-8">
      <div className="mb-6 flex justify-center">
        <SearchInput />
      </div>

      {loading ? (
        <div className="glass-panel flex h-64 flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-accentGreen" />
          <p className="text-sm text-textSecondary">Loading market data & quant models for {symbol}…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
          {/* ---- Left column: chart + trade plan ---- */}
          <div className="space-y-5">
            <div className="glass-panel p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-textPrimary">{quote?.shortName || symbol}</h2>
                  <span className="text-xs uppercase tracking-widest text-textMuted">{symbol}</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold tabular text-textPrimary">
                    {fmtUsd(quote?.regularMarketPrice, quote?.currency || 'USD')}
                  </span>
                  {quote?.regularMarketChangePercent !== undefined && (
                    <span className={clsx(
                      'rounded-md px-2 py-1 text-sm font-semibold tabular',
                      quote.regularMarketChangePercent >= 0
                        ? 'bg-emerald-400/10 text-accentGreen'
                        : 'bg-red-400/10 text-accentRed'
                    )}>
                      {quote.regularMarketChangePercent >= 0 ? '+' : ''}
                      {quote.regularMarketChangePercent?.toFixed(2)}%
                    </span>
                  )}
                  {quantSignals && (
                    <span
                      className="rounded-md px-2.5 py-1 text-sm font-bold"
                      style={{ color: signalColor, background: `${signalColor}1a` }}
                    >
                      {quantSignals.signal}
                    </span>
                  )}
                </div>
              </div>
              {chartData.length > 0 ? (
                <Chart
                  data={chartData}
                  colors={{
                    upColor: '#34D399',
                    downColor: '#F87171',
                    priceLines: levels ? [
                      { price: levels.entry, color: '#60A5FA', lineWidth: 2, lineStyle: 0, title: 'ENTRY', axisLabelVisible: true },
                      { price: levels.stop_loss, color: '#F87171', lineWidth: 2, lineStyle: 3, title: 'STOP', axisLabelVisible: true },
                      { price: levels.target_1, color: '#34D399', lineWidth: 1, lineStyle: 3, title: 'T1', axisLabelVisible: true },
                      { price: levels.target_2, color: '#34D399', lineWidth: 2, lineStyle: 3, title: 'T2', axisLabelVisible: true },
                    ] : undefined
                  }}
                />
              ) : (
                <p className="py-12 text-center text-textSecondary">No chart data available.</p>
              )}
            </div>

            {/* Quant Trade Plan */}
            {quantSignals && levels && (
              <div className="glass-panel p-5" style={{ borderTop: `2px solid ${signalColor}` }}>
                <div className="mb-4 flex items-center justify-between border-b border-borderSubtle pb-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-textPrimary">
                    <Crosshair size={15} style={{ color: signalColor }} /> Quant Trade Plan
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-textMuted">
                      Systematic multi-factor
                    </span>
                  </h3>
                  <div className="text-xs text-textMuted">
                    Conviction <span className="font-semibold tabular text-textPrimary">{(quantSignals.conviction * 100).toFixed(0)}%</span>
                    {' · '}Score <span className="font-semibold tabular" style={{ color: signalColor }}>{quantSignals.composite_score > 0 ? '+' : ''}{quantSignals.composite_score}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-accentBlue/25 bg-accentBlue/5 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-accentBlue"><Crosshair size={11} /> Entry (limit)</div>
                    <div className="mt-1 text-lg font-bold tabular text-textPrimary">{fmtUsd(levels.entry)}</div>
                  </div>
                  <div className="rounded-xl border border-red-400/25 bg-red-400/5 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-accentRed"><ShieldAlert size={11} /> Stop Loss</div>
                    <div className="mt-1 text-lg font-bold tabular text-textPrimary">{fmtUsd(levels.stop_loss)}</div>
                  </div>
                  <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-accentGreen"><Target size={11} /> Target 1 (1.5R)</div>
                    <div className="mt-1 text-lg font-bold tabular text-textPrimary">{fmtUsd(levels.target_1)}</div>
                  </div>
                  <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-accentGreen"><Target size={11} /> Target 2 (3R)</div>
                    <div className="mt-1 text-lg font-bold tabular text-textPrimary">{fmtUsd(levels.target_2)}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-textMuted">Factor votes</h4>
                    {quantSignals.factors && Object.entries(quantSignals.factors).map(([k, v]) => (
                      <FactorBar key={k} label={k} value={v as number} />
                    ))}
                  </div>
                  <div>
                    <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-textMuted">Position sizing (half-Kelly)</h4>
                    <StatRow label="Kelly fraction" value={`${(sizing.kelly_fraction * 100).toFixed(1)}%`} />
                    <StatRow label="Recommended allocation" value={`${(sizing.recommended_fraction * 100).toFixed(1)}% of equity`} valueClass="text-accentCyan" />
                    <StatRow label="Historical win rate" value={`${(sizing.win_rate * 100).toFixed(1)}%`} />
                    <StatRow label="Payoff ratio" value={`${sizing.payoff_ratio}×`} />
                    {suggestedShares !== null && suggestedShares > 0 && (
                      <StatRow label="Suggested size" value={`≈ ${suggestedShares} shares`} valueClass="text-accentGreen" />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ---- Right column ---- */}
          <div className="space-y-5">
            {/* Paper trading */}
            <Panel title="Paper Trading" icon={<Gauge size={15} className="text-accentGreen" />} accent="#34D399">
              <StatRow label="Available Cash" value={fmtUsd(balance)} valueClass="text-accentGreen font-bold" />
              {heldPosition && (
                <StatRow
                  label={`Held (${heldPosition.shares} sh)`}
                  value={`avg ${fmtUsd(heldPosition.averagePrice)}`}
                />
              )}
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={tradeShares}
                  onChange={(e) => setTradeShares(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full rounded-lg border border-borderSubtle bg-black/30 px-3 py-2.5 text-sm tabular text-textPrimary outline-none focus:border-accentGreen/50"
                />
                <span className="text-sm text-textMuted">shares</span>
              </div>
              {suggestedShares !== null && suggestedShares > 0 && (
                <button
                  onClick={() => setTradeShares(suggestedShares)}
                  className="mt-2 w-full rounded-lg border border-accentCyan/30 bg-accentCyan/5 py-1.5 text-xs text-accentCyan hover:bg-accentCyan/10 transition-colors"
                >
                  Use quant-suggested size ({suggestedShares} shares)
                </button>
              )}
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => handleTrade('BUY')}
                  className="flex-1 rounded-lg bg-accentGreen py-2.5 font-bold text-black hover:brightness-110 transition-all"
                >
                  BUY
                </button>
                <button
                  onClick={() => handleTrade('SELL')}
                  className="flex-1 rounded-lg bg-accentRed py-2.5 font-bold text-black hover:brightness-110 transition-all"
                >
                  SELL
                </button>
              </div>
              {tradeMessage && (
                <p className={clsx(
                  'mt-3 text-center text-xs',
                  tradeMessage.includes('Success') ? 'text-accentGreen' : 'text-accentRed'
                )}>
                  {tradeMessage}
                </p>
              )}
            </Panel>

            {/* Technical indicators */}
            {ind && (
              <Panel title="Technical Readout" icon={<Gauge size={15} className="text-accentBlue" />}>
                <StatRow
                  label="RSI (14)"
                  value={ind.rsi_14}
                  valueClass={ind.rsi_14 >= 70 ? 'text-accentRed' : ind.rsi_14 <= 30 ? 'text-accentGreen' : undefined}
                />
                <StatRow label="Z-Score (20d)" value={ind.zscore_20d} valueClass={Math.abs(ind.zscore_20d) > 2 ? 'text-accentAmber' : undefined} />
                {ind.half_life_days && <StatRow label="Mean-reversion half-life" value={`${ind.half_life_days}d`} />}
                <StatRow label="VWAP (20d)" value={fmtUsd(ind.vwap_20d)} />
                <StatRow
                  label="VWAP deviation"
                  value={`${ind.vwap_deviation_pct > 0 ? '+' : ''}${ind.vwap_deviation_pct}%`}
                  valueClass={ind.vwap_deviation_pct >= 0 ? 'text-accentGreen' : 'text-accentRed'}
                />
                <StatRow label="ATR (14)" value={fmtUsd(ind.atr_14)} />
                <StatRow label="Realized vol (ann.)" value={`${(ind.realized_vol_annual * 100).toFixed(1)}%`} />
                <StatRow label="Vol regime percentile" value={`${ind.vol_regime_percentile}%`} />
                <StatRow label="Bollinger %B" value={ind.bollinger_pct_b} />
                <StatRow label="Volume imbalance (10d)" value={ind.volume_imbalance} valueClass={ind.volume_imbalance > 0.5 ? 'text-accentGreen' : 'text-accentRed'} />
              </Panel>
            )}

            {/* ML insights */}
            {mlInsights && (
              <Panel title="ML Forecasts" icon={<BrainCircuit size={15} className="text-accentPurple" />} accent="#A78BFA">
                <StatRow
                  label="Next-day direction (XGBoost)"
                  value={`${(mlInsights.xgboost_probability * 100).toFixed(1)}% ${mlInsights.xgboost_probability >= 0.5 ? 'UP' : 'DOWN'}`}
                  valueClass={mlInsights.xgboost_probability >= 0.5 ? 'text-accentGreen' : 'text-accentRed'}
                />
                <StatRow
                  label="7-day forecast (Prophet)"
                  value={fmtUsd(mlInsights.prophet_7d_forecast, quote?.currency || 'USD')}
                  valueClass={mlInsights.prophet_7d_forecast > quote?.regularMarketPrice ? 'text-accentGreen' : 'text-accentRed'}
                />
                <div className="mt-3">
                  <div className="mb-1.5 flex justify-between text-[11px] text-textMuted">
                    <span>News sentiment index</span>
                    <span className="font-bold text-textPrimary">{mlInsights.fear_greed_index}/100</span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${mlInsights.fear_greed_index}%`,
                        background: 'linear-gradient(90deg, #F87171 0%, #FBBF24 50%, #34D399 100%)',
                      }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-textMuted">
                    <span>Fear</span><span>Greed</span>
                  </div>
                </div>
              </Panel>
            )}

            {/* Key stats */}
            <Panel title="Key Statistics" icon={<Gauge size={15} className="text-textSecondary" />}>
              <StatRow label="Market Cap" value={quote?.marketCap ? (quote.marketCap / 1e9).toFixed(2) + 'B' : '—'} />
              <StatRow label="Volume" value={quote?.regularMarketVolume ? (quote.regularMarketVolume / 1e6).toFixed(2) + 'M' : '—'} />
              <StatRow label="Avg Volume (3mo)" value={quote?.averageDailyVolume3Month ? (quote.averageDailyVolume3Month / 1e6).toFixed(2) + 'M' : '—'} />
              <StatRow label="52W High" value={fmtUsd(quote?.fiftyTwoWeekHigh, quote?.currency || 'USD')} />
              <StatRow label="52W Low" value={fmtUsd(quote?.fiftyTwoWeekLow, quote?.currency || 'USD')} />
            </Panel>

            {/* Ticker news */}
            {tickerNews?.articles?.length > 0 && (
              <Panel title={`${symbol} News`} icon={<Newspaper size={15} className="text-accentBlue" />}>
                <div className="mb-2 flex items-center gap-2 text-[11px] text-textMuted">
                  Sentiment:
                  <span className={clsx(
                    'flex items-center gap-1 font-semibold',
                    tickerNews.mood_index >= 55 ? 'text-accentGreen' : tickerNews.mood_index <= 45 ? 'text-accentRed' : 'text-accentAmber'
                  )}>
                    {tickerNews.mood_index >= 55 ? <TrendingUp size={11} /> : tickerNews.mood_index <= 45 ? <TrendingDown size={11} /> : <Minus size={11} />}
                    {tickerNews.mood_index}/100
                  </span>
                </div>
                <div className="space-y-2.5">
                  {tickerNews.articles.slice(0, 5).map((a: any, i: number) => (
                    <a
                      key={i}
                      href={a.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block"
                    >
                      <p className="text-xs leading-snug text-textSecondary group-hover:text-textPrimary transition-colors">
                        {a.title}
                        <ExternalLink size={10} className="ml-1 inline opacity-0 group-hover:opacity-60" />
                      </p>
                    </a>
                  ))}
                </div>
              </Panel>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScreenerPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="pt-28">
        <Suspense fallback={<div className="p-8 text-center text-textSecondary">Loading…</div>}>
          <ScreenerContent />
        </Suspense>
      </div>
    </div>
  );
}
