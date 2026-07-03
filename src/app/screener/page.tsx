"use client";
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Navigation from '../../components/Navigation';
import SearchInput from '../../components/SearchInput';
import Chart from '../../components/Chart';
import { usePortfolio } from '../../context/PortfolioContext';
import styles from './screener.module.css';

function ScreenerContent() {
  const searchParams = useSearchParams();
  const symbol = searchParams.get('q') || 'AAPL';
  const [quote, setQuote] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [mlInsights, setMlInsights] = useState<any>(null);
  const [advancedSignals, setAdvancedSignals] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Portfolio Context mapping
  const { executeTrade, balance } = usePortfolio();
  const [tradeShares, setTradeShares] = useState(1);
  const [tradeMessage, setTradeMessage] = useState('');

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
        const [quoteRes, chartRes, mlRes, signalsRes] = await Promise.all([
          fetch(`http://127.0.0.1:5000/api/quote?symbol=${symbol}`),
          fetch(`http://127.0.0.1:5000/api/chart?symbol=${symbol}&interval=1d&period1=${new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`),
          fetch(`http://127.0.0.1:5000/api/ml-insights?symbol=${symbol}`),
          fetch(`http://127.0.0.1:5000/api/advanced-signals?symbol=${symbol}`)
        ]);

        const quoteData = await quoteRes.json();
        const chartRaw = await chartRes.json();
        const mlData = await mlRes.json();
        const signalsData = await signalsRes.json();

        setQuote(quoteData);
        if (!mlData.error) setMlInsights(mlData);
        if (!signalsData.error) setAdvancedSignals(signalsData);

        if (chartRaw && chartRaw.quotes) {
          const formattedData = chartRaw.quotes
            // Filter out invalid quotes
            .filter((q: any) => q.close !== null && q.open !== null)
            .map((q: any) => ({
              time: (q.time || (q.date ? new Date(q.date).toISOString().split('T')[0] : null)) as any,
              open: q.open,
              high: q.high,
              low: q.low,
              close: q.close,
            }))
            .filter((q: any) => q.time !== null)
            // Sort to ensure chronological order for lightweight-charts
            .sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime())
            // Remove duplicates by time
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

    if (symbol) {
      fetchData();
    }
  }, [symbol]);

  return (
    <div className={styles.content}>
      <div className={styles.searchHeader}>
        <SearchInput />
      </div>
      
      {loading ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Loading market data for {symbol}...</p>
        </div>
      ) : (
        <div className={styles.grid}>
          <div className={`glass-panel ${styles.mainChart}`}>
            <div className={styles.chartHeader}>
              <h2>{quote?.shortName || symbol}</h2>
              <div className={styles.priceContainer}>
                <span className={styles.price}>
                  {quote?.regularMarketPrice 
                    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency || 'USD' }).format(quote.regularMarketPrice)
                    : '---'}
                </span>
                {quote?.regularMarketChangePercent !== undefined && (
                  <span className={quote?.regularMarketChangePercent >= 0 ? styles.positive : styles.negative}>
                    {quote?.regularMarketChangePercent >= 0 ? '+' : ''}
                    {quote?.regularMarketChangePercent?.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>
            {chartData.length > 0 ? (
              <Chart 
                data={chartData} 
                colors={{ 
                  upColor: '#00FF88', 
                  downColor: '#FF3366',
                  priceLines: advancedSignals ? [
                    { price: advancedSignals.current_price, color: advancedSignals.action === 'buy' ? '#00FF88' : '#FF3366', lineWidth: 2, lineStyle: 0, title: advancedSignals.signal, axisLabelVisible: true },
                    { price: advancedSignals.stop_loss, color: '#FF1744', lineWidth: 2, lineStyle: 3, title: 'SL', axisLabelVisible: true },
                    { price: advancedSignals.take_profit, color: '#00E676', lineWidth: 2, lineStyle: 3, title: 'TP', axisLabelVisible: true }
                  ] : undefined
                }} 
              />
            ) : (
              <p>No chart data available.</p>
            )}
          </div>
          <div className={styles.sidePanelWrapper}>
            <div className={`glass-panel ${styles.sidePanel}`}>
              <h3>Key Statistics</h3>
              <div className={styles.statRow}>
                <span>Market Cap</span>
                <span>{quote?.marketCap ? (quote.marketCap / 1e9).toFixed(2) + 'B' : 'N/A'}</span>
              </div>
              <div className={styles.statRow}>
                <span>Volume</span>
                <span>{quote?.regularMarketVolume ? (quote.regularMarketVolume / 1e6).toFixed(2) + 'M' : 'N/A'}</span>
              </div>
              <div className={styles.statRow}>
                <span>Avg Volume (3mo)</span>
                <span>{quote?.averageDailyVolume3Month ? (quote.averageDailyVolume3Month / 1e6).toFixed(2) + 'M' : 'N/A'}</span>
              </div>
              <div className={styles.statRow}>
                <span>52W High</span>
                <span>
                  {quote?.fiftyTwoWeekHigh 
                    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency || 'USD' }).format(quote.fiftyTwoWeekHigh) 
                    : 'N/A'}
                </span>
              </div>
              <div className={styles.statRow}>
                <span>52W Low</span>
                <span>
                  {quote?.fiftyTwoWeekLow 
                    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency || 'USD' }).format(quote.fiftyTwoWeekLow) 
                    : 'N/A'}
                </span>
              </div>
            </div>

            {mlInsights && (
              <div className={`glass-panel ${styles.sidePanel}`} style={{ marginTop: '1rem', borderTop: '2px solid var(--accent-purple)' }}>
                <h3>Algo Insights (Hedge Fund)</h3>
                <div className={styles.statRow}>
                  <span>Direction Probability (Next-Day)</span>
                  <span style={{ color: mlInsights.xgboost_probability >= 0.5 ? '#00FF88' : '#FF3366', fontWeight: 600 }}>
                    {(mlInsights.xgboost_probability * 100).toFixed(1)}% {mlInsights.xgboost_probability >= 0.5 ? 'UP' : 'DOWN'} <small>(XGBoost)</small>
                  </span>
                </div>
                <div className={styles.statRow}>
                  <span>7-Day Price Forecast</span>
                  <span style={{ color: mlInsights.prophet_7d_forecast > quote?.regularMarketPrice ? '#00FF88' : '#FF3366' }}>
                    {quote?.currency ? new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency }).format(mlInsights.prophet_7d_forecast) : `$${mlInsights.prophet_7d_forecast?.toFixed(2)}`} <small>(Prophet)</small>
                  </span>
                </div>
                <div className={styles.statRow} style={{ marginTop: '1rem', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ marginBottom: '0.5rem' }}>Sentiment & Mood Index (Google News)</span>
                  <div style={{ width: '100%', height: '8px', background: '#1A1A1A', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ 
                      position: 'absolute', 
                      left: 0, top: 0, height: '100%', 
                      width: `${mlInsights.fear_greed_index}%`, 
                      background: `linear-gradient(90deg, #FF3366 0%, #FFAA00 50%, #00FF88 100%)`, 
                      transition: 'width 1s ease-in-out' 
                    }} />
                  </div>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    <span>Fear (0)</span>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>{mlInsights.fear_greed_index}</span>
                    <span>Greed (100)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Paper Trading Execution Block */}
            <div className={`glass-panel ${styles.sidePanel}`} style={{ marginTop: '1rem', borderTop: '2px solid var(--accent-green)' }}>
              <h3>Paper Trading Execution</h3>
              
              <div className={styles.statRow} style={{ marginBottom: '1rem' }}>
                <span>Available Cash</span>
                <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(balance)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input 
                  type="number" 
                  min="1" 
                  value={tradeShares} 
                  onChange={(e) => setTradeShares(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '4px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)', color: '#fff' }}
                />
                <span style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Shares</span>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={() => handleTrade('BUY')}
                  style={{ flex: 1, padding: '0.75rem', background: 'var(--accent-green)', color: '#000', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                >
                  BUY
                </button>
                <button 
                  onClick={() => handleTrade('SELL')}
                  style={{ flex: 1, padding: '0.75rem', background: 'var(--accent-red)', color: '#fff', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                >
                  SELL
                </button>
              </div>

              {tradeMessage && (
                <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: tradeMessage.includes('Success') ? 'var(--accent-green)' : 'var(--accent-red)', textAlign: 'center' }}>
                  {tradeMessage}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default function ScreenerPage() {
  return (
    <div className={styles.container}>
      <Navigation />
      <Suspense fallback={<div className={styles.content}>Loading...</div>}>
        <ScreenerContent />
      </Suspense>
    </div>
  );
}
