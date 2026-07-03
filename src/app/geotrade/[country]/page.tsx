'use client';

import { use } from 'react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Newspaper, TrendingUp, AlertTriangle, Activity } from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

interface DeepAnalysis {
  countryName: string;
  thesis: string;
  headlines: string[];
  recommendations: {
    symbol: string;
    name: string;
    rationale: string;
  }[];
  error?: string;
}

export default function CountryDeepDive({ params }: { params: Promise<{ country: string }> }) {
  const { country } = use(params);
  const [data, setData] = useState<DeepAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`http://127.0.0.1:5000/api/geotrade/deep?country=${country}`)
      .then(res => res.json())
      .then(resData => {
        if (resData.error) {
          setError(resData.error);
        } else {
          setData(resData);
        }
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch deep analysis');
      })
      .finally(() => setLoading(false));
  }, [country]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pt-28 px-6 sm:px-12 lg:px-24 pb-20 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accentGreen/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10">
        <Link href="/geotrade" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 group">
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          Back to Globe
        </Link>

        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6">
            <div className="w-16 h-16 border-4 border-white/5 border-t-accentGreen rounded-full animate-spin shadow-[0_0_15px_rgba(0,255,136,0.5)]" />
            <div className="text-center">
              <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500 animate-pulse">Running Deep LLM Analysis</h2>
              <p className="text-gray-400 mt-2">Aggregating news and generating systematic strategies for {country}...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex items-start gap-4 backdrop-blur-md">
            <AlertTriangle className="text-red-500 shrink-0" size={24} />
            <div>
              <h2 className="text-lg font-bold text-red-500 mb-1">Analysis Failed</h2>
              <p className="text-gray-300">{error}</p>
            </div>
          </div>
        ) : data ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-12">
            
            {/* Header section */}
            <div className="border-b border-white/10 pb-8">
              <div className="flex items-center gap-4 mb-4">
                <span className="px-3 py-1 bg-white/10 text-gray-300 rounded-full text-sm font-mono tracking-widest">{country}</span>
                <span className="px-3 py-1 bg-accentGreen/20 text-accentGreen rounded-full text-sm font-bold flex items-center gap-2">
                  <Activity size={14} /> Global Macro
                </span>
              </div>
              <h1 className="text-5xl font-black tracking-tight">{data.countryName}</h1>
              <p className="text-xl text-gray-400 mt-4 leading-relaxed max-w-3xl">
                Real-time systematic deep-dive into the region's current economic climate and algorithmic trading opportunities.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {/* Left Column: Thesis */}
              <div className="lg:col-span-2 space-y-8">
                <section className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-accentGreen to-transparent" />
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <BookOpen className="text-accentGreen" />
                    Macroeconomic Thesis
                  </h2>
                  <div className="prose prose-invert max-w-none text-gray-300">
                    {data.thesis.split('\n\n').map((paragraph, i) => (
                      <p key={i} className="mb-4 leading-relaxed whitespace-pre-wrap">{paragraph}</p>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 px-2">
                    <Newspaper className="text-gray-400" />
                    Live Data Vector
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.headlines.map((headline, i) => (
                      <div key={i} className="bg-white/5 border border-white/5 p-4 rounded-xl text-sm text-gray-300 hover:bg-white/10 hover:border-white/10 transition-colors">
                        {headline}
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Right Column: Recommendations */}
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-white/10 rounded-3xl p-6 shadow-2xl sticky top-32">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <TrendingUp className="text-accentGreen" />
                    Target Assets
                  </h3>
                  <div className="space-y-4">
                    {data.recommendations.map((rec, i) => (
                      <div key={i} className="group relative bg-white/5 hover:bg-white/10 border border-white/5 hover:border-accentGreen/30 p-4 rounded-2xl transition-all cursor-pointer">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-mono text-lg font-bold text-white group-hover:text-accentGreen transition-colors">{rec.symbol}</span>
                          <span className="text-xs font-semibold bg-white/10 text-gray-400 px-2 py-1 rounded-md">{rec.name}</span>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">{rec.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
