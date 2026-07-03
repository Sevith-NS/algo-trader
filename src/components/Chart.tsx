"use client";
import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, CandlestickSeries, LineSeries, Time } from 'lightweight-charts';

// Custom SMA calculation
function calculateSMA(data: number[], windowSize: number): number[] {
  const sma = [];
  for (let i = windowSize - 1; i < data.length; i++) {
    const windowData = data.slice(i - windowSize + 1, i + 1);
    const sum = windowData.reduce((acc, val) => acc + val, 0);
    sma.push(sum / windowSize);
  }
  return sma;
}

interface ChartProps {
  data: { time: Time; open: number; high: number; low: number; close: number }[];
  colors?: {
    backgroundColor?: string;
    textColor?: string;
    upColor?: string;
    downColor?: string;
    borderUpColor?: string;
    borderDownColor?: string;
    wickUpColor?: string;
    wickDownColor?: string;
    priceLines?: any[];
  };
}

export default function Chart({ data, colors = {} }: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [showIndicators, setShowIndicators] = useState(false);

  const {
    backgroundColor = 'transparent',
    textColor = '#94A3B8',
    upColor = '#00FF88',
    downColor = '#FF3366',
    borderUpColor = '#00FF88',
    borderDownColor = '#FF3366',
    wickUpColor = '#00FF88',
    wickDownColor = '#FF3366',
  } = colors;

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor,
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
    });

    // Create Candlestick series using lightweight-charts v5 addSeries mapping API
    const newSeries = chart.addSeries(CandlestickSeries, {
      upColor,
      downColor,
      borderVisible: false,
      wickUpColor,
      wickDownColor,
    });

    newSeries.setData(data);
    
    // Add PriceLines
    if (colors.priceLines) {
      colors.priceLines.forEach(line => {
        newSeries.createPriceLine(line);
      });
    }

    chart.timeScale().fitContent();

    chartRef.current = chart;

    // Optional: Add simple Technical Indicators overlay (SMA 20 & SMA 50)
    if (showIndicators && data.length > 50) {
      const closePrices = data.map(d => d.close);
      const sma20 = calculateSMA(closePrices, 20);
      const sma50 = calculateSMA(closePrices, 50);

      const sma20Series = chart.addSeries(LineSeries, {
        color: '#3B82F6', // accentBlue
        lineWidth: 2,
        crosshairMarkerVisible: false,
      });

      const sma50Series = chart.addSeries(LineSeries, {
        color: '#8B5CF6', // accentPurple
        lineWidth: 2,
        crosshairMarkerVisible: false,
      });

      const sma20Data = data.map((d, i) => ({
        time: d.time,
        value: i >= 19 ? sma20[i - 19] : d.close // ta-math returns truncated arrays
      })).filter(d => !isNaN(d.value));

      const sma50Data = data.map((d, i) => ({
        time: d.time,
        value: i >= 49 ? sma50[i - 49] : d.close
      })).filter(d => !isNaN(d.value));

      sma20Series.setData(sma20Data);
      sma50Series.setData(sma50Data);
    }

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, backgroundColor, textColor, upColor, downColor, borderUpColor, borderDownColor, wickUpColor, wickDownColor, colors.priceLines, showIndicators]);

  return (
    <div className="relative w-full">
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <button 
          onClick={() => setShowIndicators(!showIndicators)}
          className={`text-xs px-2 py-1 flex items-center gap-1 rounded border transition-colors ${showIndicators ? 'bg-accentBlue/20 border-accentBlue text-accentBlue' : 'bg-black/40 border-borderSubtle text-textSecondary hover:text-white'}`}
        >
          {showIndicators ? 'Hide SMA (20/50)' : 'Show SMA (20/50)'}
        </button>
      </div>
      <div ref={chartContainerRef} style={{ width: '100%' }} />
    </div>
  );
}
