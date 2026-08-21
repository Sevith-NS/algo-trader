'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export interface Position {
  symbol: string;
  shares: number;
  averagePrice: number;
}

export interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  timestamp: number;
}

interface PortfolioContextType {
  balance: number;
  positions: Position[];
  trades: Trade[];
  executeTrade: (symbol: string, type: 'BUY' | 'SELL', shares: number, price: number) => { success: boolean, message: string };
  resetPortfolio: () => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState<number>(100000); // Start with $100k
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from local storage — defensively. PortfolioProvider wraps every page,
  // so corrupt storage (interrupted write, devtools edits) must never throw:
  // an unguarded JSON.parse here used to take down the whole app on load.
  useEffect(() => {
    try {
      const storedBalance = parseFloat(localStorage.getItem('pt_balance') ?? '');
      const storedPositions = JSON.parse(localStorage.getItem('pt_positions') ?? '[]');
      const storedTrades = JSON.parse(localStorage.getItem('pt_trades') ?? '[]');

      if (Number.isFinite(storedBalance)) setBalance(storedBalance);
      if (Array.isArray(storedPositions)) setPositions(storedPositions);
      if (Array.isArray(storedTrades)) setTrades(storedTrades);
    } catch {
      // Corrupt storage — fall back to the $100k defaults instead of crashing.
    }
    setLoaded(true);
  }, []);

  // Save to local storage
  useEffect(() => {
    if (loaded) {
      localStorage.setItem('pt_balance', balance.toString());
      localStorage.setItem('pt_positions', JSON.stringify(positions));
      localStorage.setItem('pt_trades', JSON.stringify(trades));
    }
  }, [balance, positions, trades, loaded]);

  const executeTrade = (symbol: string, type: 'BUY' | 'SELL', shares: number, price: number) => {
    const totalCost = shares * price;

    if (type === 'BUY') {
      if (balance < totalCost) {
        return { success: false, message: 'Insufficient funds' };
      }

      setBalance(prev => prev - totalCost);
      
      setPositions(prev => {
        const existing = prev.find(p => p.symbol === symbol);
        if (existing) {
          const newTotalCost = (existing.shares * existing.averagePrice) + totalCost;
          const newShares = existing.shares + shares;
          return prev.map(p => p.symbol === symbol ? { ...p, shares: newShares, averagePrice: newTotalCost / newShares } : p);
        }
        return [...prev, { symbol, shares, averagePrice: price }];
      });

    } else if (type === 'SELL') {
      const existing = positions.find(p => p.symbol === symbol);
      if (!existing || existing.shares < shares) {
        return { success: false, message: 'Insufficient shares to sell' };
      }

      setBalance(prev => prev + totalCost);
      
      setPositions(prev => {
        if (existing.shares === shares) {
          return prev.filter(p => p.symbol !== symbol); // Remove position if all shares sold
        }
        return prev.map(p => p.symbol === symbol ? { ...p, shares: p.shares - shares } : p);
      });
    }

    // Record trade
    const newTrade: Trade = {
      id: Math.random().toString(36).substring(2, 9),
      symbol,
      type,
      shares,
      price,
      timestamp: Date.now()
    };
    
    setTrades(prev => [newTrade, ...prev]);
    return { success: true, message: `Successfully ${type === 'BUY' ? 'bought' : 'sold'} ${shares} shares of ${symbol}` };
  };

  const resetPortfolio = () => {
    setBalance(100000);
    setPositions([]);
    setTrades([]);
  };

  return (
    <PortfolioContext.Provider value={{ balance, positions, trades, executeTrade, resetPortfolio }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}
