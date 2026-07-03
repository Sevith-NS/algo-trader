"use client";
import { useEffect, useState } from 'react';
import Navigation from '../../components/Navigation';
import { usePortfolio } from '../../context/PortfolioContext';
import styles from './portfolio.module.css';
import Link from 'next/link';

export default function PortfolioPage() {
  const { balance, positions, trades, resetPortfolio } = usePortfolio();
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [optimization, setOptimization] = useState<any>(null);
  const [loadingOpt, setLoadingOpt] = useState(false);

  // Fetch live prices for open positions
  useEffect(() => {
    const fetchPrices = async () => {
      if (positions.length === 0) return;
      
      const prices: Record<string, number> = {};
      await Promise.all(
        positions.map(async (pos) => {
          try {
            const res = await fetch(`http://127.0.0.1:5000/api/quote?symbol=${pos.symbol}`);
            const data = await res.json();
            if (data.regularMarketPrice) {
              prices[pos.symbol] = data.regularMarketPrice;
            }
          } catch (e) {
            console.error(e);
          }
        })
      );
      setLivePrices(prices);
    };
    fetchPrices();
    
    // Refresh prices every 30s
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [positions]);

  // Fetch Markowitz Portfolio Optimization
  useEffect(() => {
    const fetchOptimization = async () => {
      const symbols = positions.map(p => p.symbol);
      if (symbols.length < 2) return; // Needs at least 2 for Markowitz

      setLoadingOpt(true);
      try {
        const res = await fetch('http://127.0.0.1:5000/api/portfolio-optimization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols })
        });
        const data = await res.json();
        if (!data.error) {
          setOptimization(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingOpt(false);
      }
    };
    fetchOptimization();
  }, [positions]);

  const totalValue = balance + positions.reduce((acc, pos) => {
    const currentPrice = livePrices[pos.symbol] || pos.averagePrice;
    return acc + (pos.shares * currentPrice);
  }, 0);

  const totalReturn = totalValue - 100000; // Starting balance

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className={styles.container}>
      <Navigation />
      
      <div className={styles.content}>
        <div className={`glass-panel ${styles.header}`}>
          <div>
            <div className={styles.balanceLabel}>Total Account Value</div>
            <div className={styles.balanceValue}>{formatCurrency(totalValue)}</div>
            <div style={{ marginTop: '0.5rem', fontSize: '1.1rem', color: totalReturn >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {totalReturn >= 0 ? '+' : ''}{formatCurrency(totalReturn)} ({((totalReturn / 100000) * 100).toFixed(2)}%) All Time
            </div>
          </div>
          <div>
            <button className={styles.resetBtn} onClick={() => {
              if (confirm('Are you sure you want to reset your portfolio back to $100,000?')) {
                resetPortfolio();
              }
            }}>
              Reset Account
            </button>
          </div>
        </div>

        <div className={styles.grid}>
          {/* Main Holdings Table */}
          <div className={`glass-panel ${styles.card}`}>
            <h2 className={styles.cardTitle}>Open Positions</h2>
            {positions.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Shares</th>
                      <th>Avg Price</th>
                      <th>Current Price</th>
                      <th>Total Value</th>
                      <th>Unrealized P&L</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map(pos => {
                      const currentPrice = livePrices[pos.symbol] || pos.averagePrice;
                      const currentValue = pos.shares * currentPrice;
                      const costBasis = pos.shares * pos.averagePrice;
                      const pnl = currentValue - costBasis;
                      const pnlPercent = (pnl / costBasis) * 100;

                      return (
                        <tr key={pos.symbol}>
                          <td style={{ fontWeight: 'bold' }}>{pos.symbol}</td>
                          <td>{pos.shares}</td>
                          <td>{formatCurrency(pos.averagePrice)}</td>
                          <td>{livePrices[pos.symbol] ? formatCurrency(currentPrice) : 'Fetching...'}</td>
                          <td>{formatCurrency(currentValue)}</td>
                          <td className={pnl >= 0 ? styles.positive : styles.negative}>
                            {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)} ({pnlPercent.toFixed(2)}%)
                          </td>
                          <td>
                            <Link href={`/screener?q=${pos.symbol}`} style={{ color: 'var(--accent-blue)', textDecoration: 'underline', fontSize: '0.9rem' }}>
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
              <div className={styles.emptyState}>
                <p>No open positions.</p>
                <Link href="/screener" style={{ color: 'var(--accent-green)', marginTop: '1rem', display: 'inline-block' }}>Go to Screener</Link>
              </div>
            )}
          </div>

          {/* Side Panel for ML Portfolio Optimization & History */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            <div className={`glass-panel ${styles.card}`}>
              <h2 className={styles.cardTitle}>Markowitz Optimization <span style={{fontSize:'0.6rem', background:'var(--accent-blue)', padding:'2px 6px', borderRadius:'4px', marginLeft:'8px'}}>AI</span></h2>
              {positions.length < 2 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Hold at least 2 distinct assets to calculate efficient frontier matrix.</p>
              ) : loadingOpt ? (
                <p style={{ color: 'var(--text-secondary)' }}>Calculating Efficient Frontier and CAPM metrics...</p>
              ) : optimization ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Exp. Return (Annual)</span>
                    <span className={styles.positive}>+{(optimization.portfolio_expected_annual_return * 100).toFixed(2)}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Volatility Risk</span>
                    <span>{(optimization.portfolio_annual_volatility * 100).toFixed(2)}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Sharpe Ratio</span>
                    <span style={{ fontWeight: 'bold' }}>{optimization.portfolio_sharpe_ratio.toFixed(2)}</span>
                  </div>
                  
                  <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                    <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Optimal Hedge-Fund Weighting</h4>
                    {Object.entries(optimization.asset_details).map(([sym, details]: [string, any]) => (
                      <div key={sym} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        <span>{sym} (β: {details.beta.toFixed(2)})</span>
                        <span style={{ color: 'var(--accent-green)' }}>{(details.optimal_weight * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)' }}>Failed to calculate optimal weights.</p>
              )}
            </div>

            <div className={`glass-panel ${styles.card}`}>
              <h2 className={styles.cardTitle}>Trade History</h2>
              {trades.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
                  {trades.slice(0, 50).map(trade => (
                    <div key={trade.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                      <div>
                        <span className={trade.type === 'BUY' ? styles.tradeBadgeBuy : styles.tradeBadgeSell} style={{ marginRight: '0.5rem' }}>
                          {trade.type}
                        </span>
                        <span style={{ fontWeight: 'bold' }}>{trade.symbol}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div>{trade.shares} @ {formatCurrency(trade.price)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {new Date(trade.timestamp).toLocaleDateString()} {new Date(trade.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No trade history yet.</p>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
