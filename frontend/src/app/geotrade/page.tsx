'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Globe2, AlertCircle, Info, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';
import { API_BASE } from '../../lib/api';

// Globe must be dynamically imported with ssr: false since it uses the window object
const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

interface CountryData {
  countryCode: string;
  score: number;
  label: string;
  trades: string[];
}

export default function GeotradePage() {
  const router = useRouter();
  const [countries, setCountries] = useState<{ features: any[] }>({ features: [] });
  const [analysisData, setAnalysisData] = useState<CountryData[]>([]);
  const [hoverD, setHoverD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const globeEl = useRef<any>(null);

  useEffect(() => {
    // Topojson is not required if we use standard geojson format directly.
    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(res => {
        if (!res.ok) throw new Error(`geojson ${res.status}`);
        return res.json();
      })
      .then(data => {
        setCountries(data);
      })
      .catch(() => {
        // Without country shapes there is no globe to draw — say so instead
        // of leaving a silent black page.
        setError('Could not load world map data (github.com unreachable). Check your connection and reload.');
      });

    // Fetch the live LLM Geotrade Analysis
    fetch(`${API_BASE}/api/geotrade`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setAnalysisData(data);
        }
        setLoading(false);
      })
      .catch(err => {
        setError("Failed to fetch data from Python Backend. Please ensure backend is running.");
        setLoading(false);
      });
  }, []);

  const getCountryInfo = (countryCode: string) => {
    return analysisData.find(d => d.countryCode === countryCode);
  };

  // Natural Earth ships ISO_A3='-99' for France, Norway, Kosovo etc. —
  // fall back to ADM0_A3 so they color and route correctly.
  const isoOf = (feat: any) =>
    feat?.properties?.ISO_A3 && feat.properties.ISO_A3 !== '-99'
      ? feat.properties.ISO_A3
      : feat?.properties?.ADM0_A3;

  const getPolygonColor = (feat: any) => {
    const isoCode = isoOf(feat);
    const info = getCountryInfo(isoCode);
    
    if (!info) return 'rgba(200, 200, 200, 0.1)'; // Neutral if no data

    // score usually from -1.0 to 1.0
    const val = info.score;
    // Map -1..1 to pure red to pure green
    if (val > 0) {
      return `rgba(34, 197, 94, ${Math.min(val + 0.2, 0.9)})`; // Green
    } else {
      return `rgba(239, 68, 68, ${Math.min(Math.abs(val) + 0.2, 0.9)})`; // Red
    }
  };

  const hoveredInfo = useMemo(() => {
    if (!hoverD) return null;
    return getCountryInfo(isoOf(hoverD));
  }, [hoverD, analysisData]);

  // Adjust globe view on start
  useEffect(() => {
    if (globeEl.current) {
      globeEl.current.controls().autoRotate = true;
      globeEl.current.controls().autoRotateSpeed = 0.5;
      globeEl.current.pointOfView({ altitude: 2 });
    }
  }, [loading]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-bgPrimary pt-24 text-textPrimary">
      <Navigation />

      {/* Background gradient effects */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-accentGreen/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
      
      <div className="absolute top-24 left-8 z-10 max-w-md pointer-events-none">
        {/* Overlay header: same type scale as PageHeader, but this page is
            full-bleed around the globe so it cannot use the shared shell. */}
        <h1 className="mb-2 flex items-center gap-3 text-3xl font-black tracking-tight text-textPrimary sm:text-4xl">
          <Globe2 className="text-accentGreen" size={26} />
          Geotrade
        </h1>
        <p className="mb-6 max-w-2xl text-sm leading-relaxed text-textSecondary">
          Macro sentiment per country, scored from world news flow. Read it as
          context for a position, not as a signal to take one.
        </p>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-bgSecondary/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-borderSubtle border-t-accentGreen rounded-full animate-spin"></div>
            <p className="text-accentGreen font-medium animate-pulse">LLM is analyzing global news...</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="absolute top-48 left-1/2 -translate-x-1/2 w-full max-w-lg z-50">
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 shadow-2xl backdrop-blur-md">
            <AlertCircle className="flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold mb-1">Analysis Error</h3>
              <p className="text-sm opacity-90">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Globe */}
      <div className="absolute inset-0 top-0 left-0 right-0 bottom-0 z-0 opacity-90">
        {!loading && countries.features.length > 0 && typeof window !== 'undefined' && (
          <Globe
            ref={globeEl}
            // Use slightly muted blue-black earth color with atmospheric space
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
            polygonsData={countries.features}
            polygonAltitude={d => d === hoverD ? 0.12 : 0.05}
            polygonCapColor={getPolygonColor}
            polygonSideColor={() => 'rgba(0, 0, 0, 0.15)'}
            polygonStrokeColor={() => '#111'}
            polygonLabel={() => ''} // Clear default tooltip since we draw a custom one
            onPolygonHover={setHoverD}
            onPolygonClick={(feat: any) => {
              const iso = isoOf(feat);
              if (iso) router.push(`/geotrade/${iso}`);
            }}
          />
        )}
      </div>

      {/* Interactive LLM Analysis Panel overlay */}
      <AnimatePresence>
        {hoverD && hoveredInfo && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="absolute bottom-8 right-8 w-80 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-2xl z-20"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{hoverD.properties.ADMIN}</h2>
                <div className="flex items-center gap-2 text-sm text-textSecondary mt-1">
                  <span className="opacity-80">Sentiment Score:</span>
                  <span className={`font-mono font-bold ${hoveredInfo.score > 0 ? "text-accentGreen" : "text-red-400"}`}>
                    {hoveredInfo.score.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className={`p-2 rounded-xl bg-opacity-10 backdrop-blur-md ${hoveredInfo.score > 0 ? "bg-accentGreen text-accentGreen" : "bg-red-500 text-red-500"}`}>
                {hoveredInfo.score > 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              </div>
            </div>

            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider mb-5 ${hoveredInfo.score > 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
              <Sparkles size={12} />
              {hoveredInfo.label}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-textSecondary flex items-center gap-2 font-mono uppercase tracking-wide">
                <Activity size={14} className="opacity-50" />
                Algorithmic Trade Strategy
              </h4>
              <ul className="space-y-2">
                {hoveredInfo.trades.map((trade, i) => (
                  <li key={i} className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-sm hover:bg-white/10 transition-colors cursor-default">
                    <span className="w-1.5 h-1.5 rounded-full bg-accentGreen shrink-0" />
                    {trade}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hoverD && !hoveredInfo && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-bgPrimary/85 backdrop-blur-lg border border-white/10 text-textPrimary px-6 py-3 rounded-full flex items-center gap-3 z-20"
          >
            <Info size={18} className="text-textSecondary" />
            <span>No immediate macro LLM signals detected for <strong>{hoverD.properties.ADMIN}</strong>.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
