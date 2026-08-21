'use client';

import { useState, useEffect } from 'react';
import Navigation from '../../components/Navigation';
import dynamic from 'next/dynamic';
import { Settings, BarChart2, Activity, PieChart, Users } from 'lucide-react';
import { migrateLegacyStorageKeys } from '../../lib/legacyStorage';

const ResponsiveGridLayout = dynamic(() => import('./ClientGrid'), { ssr: false });

// Dynamic import for complex charts to avoid SSR mismatch
const DynamicChart = dynamic(() => import('../../components/Chart'), { ssr: false });

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [symbol, setSymbol] = useState('AAPL');
  
  // Default workspace layout - imitating a Bloomberg Terminal setup
  const [layouts, setLayouts] = useState({
    lg: [
      { i: 'chart', x: 0, y: 0, w: 8, h: 4, minW: 4, minH: 3 },
      { i: 'portfolio', x: 8, y: 0, w: 4, h: 2, minW: 3, minH: 2 },
      { i: 'ml-insights', x: 8, y: 2, w: 4, h: 2, minW: 3, minH: 2 },
      { i: 'community', x: 0, y: 4, w: 6, h: 3, minW: 4, minH: 2 },
      { i: 'news', x: 6, y: 4, w: 6, h: 3, minW: 4, minH: 2 }
    ]
  });

  useEffect(() => {
    setMounted(true);
    // In a real app, load layouts from localStorage or Prisma DB here
    migrateLegacyStorageKeys();
    const savedLayout = localStorage.getItem('flint.dashboard.layout.v1');
    if (savedLayout) {
      try { setLayouts(JSON.parse(savedLayout)); } catch(e) {}
    }
  }, []);

  const handleLayoutChange = (layout: any[], allLayouts: any) => {
    setLayouts(allLayouts);
    localStorage.setItem('flint.dashboard.layout.v1', JSON.stringify(allLayouts));
  };

  // Mock data for the layout widgets to display immediately without heavy fetching
  const [mockChartData, setMockChartData] = useState<any[]>([]);
  useEffect(() => {
    if (mounted) {
      // Generate some dummy candlestick data for the widget preview
      const d = [];
      let lastClose = 150;
      for (let i = 0; i < 100; i++) {
        const time = new Date();
        time.setDate(time.getDate() - (100 - i));
        const dateStr = time.toISOString().split('T')[0];
        
        const open = lastClose + (Math.random() - 0.5) * 2;
        const close = open + (Math.random() - 0.5) * 3;
        const high = Math.max(open, close) + Math.random();
        const low = Math.min(open, close) - Math.random();
        lastClose = close;
        
        d.push({ time: dateStr, open, high, low, close });
      }
      setMockChartData(d);
    }
  }, [mounted]);

  if (!mounted) return <div className="min-h-screen bg-bgPrimary" />;

  return (
    <div className="min-h-screen bg-bgPrimary flex flex-col">
      <Navigation />
      
      {/* Dashboard Toolbar */}
      <div className="bg-bgSecondary border-b border-borderSubtle px-4 py-2 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-textPrimary font-bold opacity-80 flex items-center gap-2">
            <Activity size={18} className="text-accentBlue" /> Terminal Workspace
          </h1>
          <div className="h-4 w-px bg-borderSubtle"></div>
          {/* The span was floating next to the input, not bound to it: a real
              <label> gives the field a name for assistive tech and makes the
              text a click target that focuses the input. */}
          <div className="flex min-h-9 items-center gap-2 rounded-lg border border-borderSubtle bg-black/40 px-2">
            <label
              htmlFor="dashboard-symbol"
              className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] text-textMuted"
            >
              Active asset
            </label>
            <input
              id="dashboard-symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              spellCheck={false}
              autoComplete="off"
              className="ticker w-20 bg-transparent text-sm uppercase text-textPrimary transition-colors duration-150 focus:text-accentGreen"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => { localStorage.removeItem('flint.dashboard.layout.v1'); window.location.reload(); }}
            className="text-xs text-textSecondary hover:text-textPrimary px-3 py-1.5 border border-borderSubtle rounded transition-colors"
          >
            Reset Layout
          </button>
          <button className="text-xs bg-accentBlue/10 text-accentBlue hover:bg-accentBlue/20 px-3 py-1.5 rounded transition-colors flex items-center gap-1 border border-accentBlue/30">
            <Settings size={14} /> Save Module
          </button>
        </div>
      </div>

      <main className="flex-1 w-full p-2 relative">
         <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={100}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".widget-header"
        >
          {/* Chart Widget */}
          <div key="chart" className="glass-panel overflow-hidden flex flex-col relative group">
            <div className="widget-header bg-black/40 p-2 cursor-move border-b border-borderSubtle flex justify-between items-center">
              <span className="text-sm font-bold flex items-center gap-2">
                <BarChart2 size={16} className="text-accentGreen"/> {symbol} Advanced Chart
              </span>
            </div>
            <div className="flex-1 w-full h-full relative p-2">
              {mockChartData.length > 0 && <DynamicChart data={mockChartData} symbol={symbol} />}
            </div>
          </div>

          {/* Portfolio Summary Widget */}
          <div key="portfolio" className="glass-panel overflow-hidden flex flex-col relative group">
            <div className="widget-header bg-black/40 p-2 cursor-move border-b border-borderSubtle flex justify-between items-center">
              <span className="text-sm font-bold flex items-center gap-2 text-textPrimary">
                <PieChart size={16} className="text-accentPurple"/> Portfolio Quick View
              </span>
            </div>
            <div className="flex-1 p-4 flex flex-col justify-center">
              <div className="text-sm text-textSecondary">Total Balance</div>
              <div className="text-3xl font-bold text-accentGreen">$100,000.00</div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm border-b border-white/5 pb-1">
                  <span>Buying Power</span>
                  <span className="text-textPrimary">$100,000.00</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Day P&L</span>
                  <span className="text-accentGreen">+$0.00</span>
                </div>
              </div>
            </div>
          </div>

          {/* ML Insights Widget */}
          <div key="ml-insights" className="glass-panel overflow-hidden flex flex-col relative group">
            <div className="widget-header bg-black/40 p-2 cursor-move border-b border-borderSubtle flex justify-between items-center">
              <span className="text-sm font-bold flex items-center gap-2">
                <Settings size={16} className="text-accentBlue"/> {symbol} Quant Analysis
              </span>
            </div>
            <div className="flex-1 p-4 space-y-3">
              <div className="flex justify-between items-center bg-black/30 p-2 rounded">
                <span className="text-sm text-textSecondary">XGBoost 1D Prob</span>
                <span className="text-sm font-bold text-accentGreen">62.5%</span>
              </div>
              <div className="flex justify-between items-center bg-black/30 p-2 rounded">
                <span className="text-sm text-textSecondary">Prophet 7D Trend</span>
                <span className="text-sm font-bold text-accentGreen">UP</span>
              </div>
              <div className="flex justify-between items-center bg-black/30 p-2 rounded border-l-2 border-accentRed">
                <span className="text-sm text-textSecondary">Smart Stop Loss</span>
                <span className="text-sm font-bold text-textPrimary">$142.50</span>
              </div>
            </div>
          </div>

          {/* Community Stream Widget */}
          <div key="community" className="glass-panel overflow-hidden flex flex-col relative group">
            <div className="widget-header bg-black/40 p-2 cursor-move border-b border-borderSubtle flex justify-between items-center">
              <span className="text-sm font-bold flex items-center gap-2">
                <Users size={16} className="text-accentAmber"/> Live Community Sentiment
              </span>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              <div className="border-l-2 border-accentGreen pl-3 pb-2 border-b border-borderSubtle">
                <div className="flex justify-between">
                  <span className="text-xs font-bold text-textPrimary">TSLA Gap Fill</span>
                  <span className="text-xs text-accentGreen">BULLISH</span>
                </div>
                <div className="text-xs text-textSecondary mt-1">AI Conf: 85/100</div>
              </div>
              <div className="border-l-2 border-accentRed pl-3 pb-2 border-b border-borderSubtle">
                <div className="flex justify-between">
                  <span className="text-xs font-bold text-textPrimary">AAPL Rejection</span>
                  <span className="text-xs text-accentRed">BEARISH</span>
                </div>
                <div className="text-xs text-textSecondary mt-1">AI Conf: 60/100</div>
              </div>
            </div>
          </div>

          {/* Global News Stream */}
          <div key="news" className="glass-panel overflow-hidden flex flex-col relative group border-accentBlue/20">
            <div className="widget-header bg-black/40 p-2 cursor-move border-b border-borderSubtle flex justify-between items-center">
              <span className="text-sm font-bold flex items-center gap-2">
                <Activity size={16} className="text-accentBlue"/> Global Market News
              </span>
            </div>
            <div className="flex-1 p-4 text-center flex flex-col items-center justify-center text-textSecondary text-sm">
                Fetching Bloomberg/Reuters RSS Feeds... <br/> (Placeholder for News Component)
            </div>
          </div>

        </ResponsiveGridLayout>
      </main>
      
      {/* Global overriding styles specifically for react-grid-layout targeting our specific dark theme */}
      <style dangerouslySetInnerHTML={{__html: `
        .react-grid-item.react-grid-placeholder {
          background: rgba(0, 255, 136, 0.2) !important;
          border-radius: 8px;
        }
        .react-resizable-handle::after {
          border-right: 2px solid rgba(255,255,255,0.3) !important;
          border-bottom: 2px solid rgba(255,255,255,0.3) !important;
        }
      `}} />
    </div>
  );
}
