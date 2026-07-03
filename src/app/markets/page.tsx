'use client';

import { useEffect, useState } from 'react';
import Navigation from '../../components/Navigation';
import Link from 'next/link';

interface MarketAsset {
  symbol: string;
  price: number;
  change: number;
  volume: number;
  marketCap: number;
}

interface MarketOverviewData {
  top_gainers: MarketAsset[];
  top_losers: MarketAsset[];
  most_active: MarketAsset[];
  all_assets: MarketAsset[];
}

export default function MarketsPage() {
  const [data, setData] = useState<MarketOverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMarkets() {
      try {
        const res = await fetch('http://127.0.0.1:5000/api/market-overview');
        const json = await res.json();
        if (!json.error) setData(json);
      } catch (e) {
        console.error('Failed to fetch market overview', e);
      } finally {
        setLoading(false);
      }
    }
    fetchMarkets();
  }, []);

  const getHeatmapColor = (change: number) => {
    if (change >= 5) return 'bg-green-600';
    if (change >= 2) return 'bg-green-500';
    if (change > 0) return 'bg-green-400/80';
    if (change <= -5) return 'bg-red-600';
    if (change <= -2) return 'bg-red-500';
    if (change < 0) return 'bg-red-400/80';
    return 'bg-gray-600';
  };

  const getSizingClass = (marketCap: number) => {
    if (marketCap > 2000000000000) return 'col-span-2 row-span-2'; // > $2T Apple/MSFT
    if (marketCap > 1000000000000) return 'col-span-2 row-span-1'; // > $1T 
    return 'col-span-1 row-span-1';
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="min-h-screen bg-bgPrimary flex flex-col">
      <Navigation />
      
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8 tracking-tight">Market Overview</h1>

        {loading ? (
          <div className="flex items-center justify-center h-64 glass-panel">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accentGreen"></div>
          </div>
        ) : !data ? (
          <div className="glass-panel p-8 text-center text-textSecondary">Failed to load market data. Ensure Python backend is running.</div>
        ) : (
          <div className="space-y-8">
            
            {/* Global Heatmap */}
            <section>
              <h2 className="text-xl font-semibold mb-4 text-textSecondary">S&P 500 Heatmap Preview</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 auto-rows-[100px]">
                {data.all_assets.map(asset => (
                  <Link 
                    href={`/screener?q=${asset.symbol}`} 
                    key={asset.symbol}
                    className={`${getHeatmapColor(asset.change)} ${getSizingClass(asset.marketCap)} rounded-md p-3 flex flex-col justify-between hover:brightness-110 transition-all cursor-pointer`}
                  >
                    <div className="font-bold text-white tracking-wide">{asset.symbol}</div>
                    <div>
                      <div className="text-white/90 text-sm font-medium">{formatCurrency(asset.price)}</div>
                      <div className="text-white/80 text-xs font-bold">
                        {asset.change >= 0 ? '+' : ''}{asset.change.toFixed(2)}%
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* Top Movers Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              <div className="glass-panel p-5">
                <h3 className="text-lg font-semibold mb-4 text-accentGreen border-b border-borderSubtle pb-2">Top Gainers</h3>
                <div className="space-y-3">
                  {data.top_gainers.map(asset => (
                    <Link href={`/screener?q=${asset.symbol}`} key={asset.symbol} className="flex justify-between items-center hover:bg-white/5 p-2 rounded transition-colors">
                      <span className="font-bold">{asset.symbol}</span>
                      <div className="text-right">
                        <div>{formatCurrency(asset.price)}</div>
                        <div className="text-accentGreen text-sm">+{asset.change.toFixed(2)}%</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="glass-panel p-5">
                <h3 className="text-lg font-semibold mb-4 text-accentRed border-b border-borderSubtle pb-2">Top Losers</h3>
                <div className="space-y-3">
                  {data.top_losers.reverse().map(asset => (
                    <Link href={`/screener?q=${asset.symbol}`} key={asset.symbol} className="flex justify-between items-center hover:bg-white/5 p-2 rounded transition-colors">
                      <span className="font-bold">{asset.symbol}</span>
                      <div className="text-right">
                        <div>{formatCurrency(asset.price)}</div>
                        <div className="text-accentRed text-sm">{asset.change.toFixed(2)}%</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="glass-panel p-5">
                <h3 className="text-lg font-semibold mb-4 text-accentBlue border-b border-borderSubtle pb-2">Most Active</h3>
                <div className="space-y-3">
                  {data.most_active.map(asset => (
                    <Link href={`/screener?q=${asset.symbol}`} key={asset.symbol} className="flex justify-between items-center hover:bg-white/5 p-2 rounded transition-colors">
                      <span className="font-bold">{asset.symbol}</span>
                      <div className="text-right">
                        <div>{formatCurrency(asset.price)}</div>
                        <div className="text-textSecondary text-sm">Vol: {(asset.volume / 1000000).toFixed(1)}M</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}
      </main>
    </div>
  );
}
