'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Environment, Preload } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { animate, stagger } from 'animejs';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  Crosshair, ShieldAlert, Newspaper, Bot, ArrowRight, LineChart, Globe2, Braces,
  TrendingUp, TrendingDown, ChevronRight,
} from 'lucide-react';
import Navigation from '../components/Navigation';

// Magic UI
import { Marquee } from '../components/magicui/Marquee';
import { BorderBeam } from '../components/magicui/BorderBeam';
import { ShimmerButton } from '../components/magicui/ShimmerButton';
import { Meteors } from '../components/magicui/Meteors';
import { AnimatedGradientText } from '../components/magicui/AnimatedGradientText';

// React Bits
import SplitText from '../components/reactbits/SplitText';
import ShinyText from '../components/reactbits/ShinyText';
import GradientText from '../components/reactbits/GradientText';
import SpotlightCard from '../components/reactbits/SpotlightCard';
import CountUp from '../components/reactbits/CountUp';

// Shared scroll state: ScrollTrigger writes, useFrame reads (no re-renders)
const scrollState = { progress: 0 };

/* ================================ 3D SCENE ================================ */

function CandlestickField() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const COUNT = 180;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const candles = useMemo(() => {
    const arr = [];
    for (let i = 0; i < COUNT; i++) {
      const col = i % 30;
      const row = Math.floor(i / 30);
      arr.push({
        x: (col - 15) * 1.1 + (row % 2) * 0.5,
        z: -4 - row * 2.2,
        seed: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.8,
        up: Math.random() > 0.45,
      });
    }
    return arr;
  }, []);

  useEffect(() => {
    if (!meshRef.current) return;
    const green = new THREE.Color('#34D399');
    const red = new THREE.Color('#F87171');
    candles.forEach((c, i) => meshRef.current!.setColorAt(i, c.up ? green : red));
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [candles]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    const lift = scrollState.progress * 2.5;
    candles.forEach((c, i) => {
      const h = 0.6 + Math.abs(Math.sin(c.seed + t * c.speed)) * 2.2;
      dummy.position.set(c.x, h / 2 - 2.5 + Math.sin(c.seed + t * 0.3) * 0.15 - lift, c.z);
      dummy.scale.set(0.32, h, 0.32);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial emissiveIntensity={0.55} emissive="#0c1424" metalness={0.6} roughness={0.3} transparent opacity={0.9} />
    </instancedMesh>
  );
}

function CoreKnot() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();

  useFrame((state) => {
    if (!meshRef.current) return;
    const targetX = (state.pointer.x * viewport.width) / 6;
    const targetY = (state.pointer.y * viewport.height) / 6;
    meshRef.current.position.x += (targetX - meshRef.current.position.x) * 0.06;
    meshRef.current.position.y += (targetY + 0.4 - meshRef.current.position.y) * 0.06;
    meshRef.current.rotation.x += 0.004;
    meshRef.current.rotation.y += 0.007;
    // Scroll morph: spin faster + recede as you scroll
    const p = scrollState.progress;
    meshRef.current.rotation.z = p * Math.PI * 1.5;
    meshRef.current.position.z = -p * 6;
    const s = 1 - p * 0.35;
    meshRef.current.scale.set(s, s, s);
  });

  return (
    <Float speed={2.2} rotationIntensity={0.6} floatIntensity={1.4}>
      <mesh ref={meshRef} position={[0, 0.4, 0]}>
        <torusKnotGeometry args={[1.45, 0.42, 220, 36]} />
        <meshPhysicalMaterial
          color="#34D399"
          metalness={0.95}
          roughness={0.12}
          clearcoat={1}
          emissive="#34D399"
          emissiveIntensity={0.28}
          wireframe
        />
      </mesh>
    </Float>
  );
}

function ParticleField() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 1600;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      arr[i] = (Math.random() - 0.5) * 42;
      arr[i + 1] = (Math.random() - 0.5) * 26;
      arr[i + 2] = (Math.random() - 0.5) * 30 - 4;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.y = t * 0.03 + scrollState.progress * 0.8;
    ref.current.rotation.x = t * 0.012;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.045} color="#60A5FA" transparent opacity={0.55} sizeAttenuation />
    </points>
  );
}

function CameraRig() {
  useFrame((state) => {
    const p = scrollState.progress;
    state.camera.position.z = 8 + p * 4;
    state.camera.position.y = p * 1.6;
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

function Scene() {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 46 }} dpr={[1, 1.8]}>
      <fog attach="fog" args={['#07090F', 12, 34]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[8, 12, 6]} intensity={1.4} color="#bcd3ff" />
      <pointLight position={[-6, -4, 2]} intensity={0.6} color="#34D399" />
      <CameraRig />
      <CoreKnot />
      <CandlestickField />
      <ParticleField />
      <Environment preset="city" />
      <Preload all />
    </Canvas>
  );
}

/* ============================== UI PIECES ================================ */

// framer-motion 3D tilt card
function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 220, damping: 22 });
  const sy = useSpring(my, { stiffness: 220, damping: 22 });
  const rotateY = useTransform(sx, [0, 1], [-7, 7]);
  const rotateX = useTransform(sy, [0, 1], [7, -7]);

  return (
    <motion.div
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 900 }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      }}
      onMouseLeave={() => { mx.set(0.5); my.set(0.5); }}
      whileHover={{ scale: 1.02 }}
      className={`glass-panel relative h-full p-6 ${className}`}
    >
      <div style={{ transform: 'translateZ(28px)', transformStyle: 'preserve-3d' }}>
        {children}
      </div>
    </motion.div>
  );
}

// Magic UI Marquee cell — one ticker chip
function TickerChip({ symbol, price, change }: { symbol: string; price: string; change: number }) {
  const up = change >= 0;
  return (
    <div className="mx-2 flex items-center gap-3 rounded-full border border-borderSubtle bg-white/[0.03] px-5 py-2.5 font-mono text-[13px] backdrop-blur-sm">
      <span className="font-bold text-textPrimary">{symbol}</span>
      <span className="tabular text-textSecondary">{price}</span>
      <span className={`flex items-center gap-1 tabular font-semibold ${up ? 'text-accentGreen' : 'text-accentRed'}`}>
        {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
        {up ? '+' : ''}{change.toFixed(2)}%
      </span>
    </div>
  );
}

const TICKERS_A = [
  { symbol: 'AAPL', price: '311.20', change: 1.24 },
  { symbol: 'NVDA', price: '188.45', change: 3.87 },
  { symbol: 'TSLA', price: '412.09', change: -2.13 },
  { symbol: 'MSFT', price: '502.66', change: 0.58 },
  { symbol: 'AMZN', price: '231.14', change: 1.02 },
  { symbol: 'META', price: '744.31', change: -0.76 },
];

const TICKERS_B = [
  { symbol: 'BTC-USD', price: '112,480', change: 2.41 },
  { symbol: 'ETH-USD', price: '4,102', change: -1.18 },
  { symbol: 'SPY', price: '682.55', change: 0.34 },
  { symbol: 'QQQ', price: '612.90', change: 0.71 },
  { symbol: 'GLD', price: '312.77', change: -0.22 },
  { symbol: 'VIX', price: '14.82', change: -4.05 },
];

const FEATURES = [
  {
    icon: <Crosshair size={22} className="text-accentGreen" />,
    title: 'Quant Trade Plans',
    desc: 'Five-factor systematic engine — OU mean reversion, momentum, VWAP, order-flow, RSI — voting into executable entry, ATR stop and R-multiple targets with half-Kelly sizing.',
    href: '/screener',
    spotlight: 'rgba(52, 211, 153, 0.16)',
    beamFrom: '#34D399',
    beamTo: '#22D3EE',
  },
  {
    icon: <ShieldAlert size={22} className="text-accentRed" />,
    title: 'Institutional Risk',
    desc: '95% VaR & expected shortfall in dollars, Sharpe, Sortino, max drawdown, beta and diversification scoring — recomputed live on your portfolio.',
    href: '/portfolio',
    spotlight: 'rgba(248, 113, 113, 0.14)',
    beamFrom: '#F87171',
    beamTo: '#FBBF24',
  },
  {
    icon: <Newspaper size={22} className="text-accentBlue" />,
    title: 'Global News Sentiment',
    desc: 'Headlines across 8 market categories scored with NLP in real time, aggregated into fear/greed mood indices per region and asset class.',
    href: '/news',
    spotlight: 'rgba(96, 165, 250, 0.15)',
    beamFrom: '#60A5FA',
    beamTo: '#22D3EE',
  },
  {
    icon: <Bot size={22} className="text-accentPurple" />,
    title: 'AI Copilot',
    desc: 'A portfolio-aware assistant grounded in your live positions, quant signals and news flow. Ask it anything — it cites real numbers, not vibes.',
    href: '/screener',
    spotlight: 'rgba(167, 139, 250, 0.15)',
    beamFrom: '#A78BFA',
    beamTo: '#60A5FA',
  },
];

const STATS = [
  { value: 5, suffix: '', label: 'Alpha factor families' },
  { value: 12, suffix: '+', label: 'Risk & return metrics' },
  { value: 8, suffix: '', label: 'News categories scored' },
  { value: 100, suffix: 'k', label: 'Paper capital to master', prefix: '$' },
];

const WORKFLOW_STEPS = [
  { icon: <LineChart size={16} className="text-accentGreen" />, t: 'Screen', d: 'Multi-factor composite scores every ticker with entry, stop and targets drawn on the chart.' },
  { icon: <Braces size={16} className="text-accentCyan" />, t: 'Size', d: 'Half-Kelly, conviction-scaled position sizing caps your exposure before you click buy.' },
  { icon: <Globe2 size={16} className="text-accentBlue" />, t: 'Context', d: 'Global news mood, ML forecasts and macro geotrade views frame every decision.' },
  { icon: <ShieldAlert size={16} className="text-accentRed" />, t: 'Manage', d: 'Portfolio VaR, drawdown and correlation update as positions move — with an AI to explain it all.' },
];

/* ================================ PAGE =================================== */

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const workflowRef = useRef<HTMLDivElement>(null);

  // GSAP: scroll rig, hero, feature cascade, CTA
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // Global scroll progress → 3D scene
      ScrollTrigger.create({
        trigger: rootRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.6,
        onUpdate: (self) => { scrollState.progress = self.progress; },
      });

      // Hero secondary elements (headlines are handled by SplitText)
      gsap.from('[data-hero-fade]', {
        y: 24, opacity: 0, duration: 0.9, stagger: 0.12, delay: 0.7, ease: 'power3.out',
      });

      // Dim the 3D scene as content takes over
      gsap.to(canvasWrapRef.current, {
        opacity: 0.28,
        scrollTrigger: { trigger: '[data-features]', start: 'top 85%', end: 'top 30%', scrub: true },
      });

      // Feature cards cascade in
      gsap.from('[data-feature-card]', {
        y: 70, opacity: 0, stagger: 0.12, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: '[data-features]', start: 'top 78%' },
      });

      // CTA reveal
      gsap.from('[data-cta]', {
        scale: 0.92, opacity: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: '[data-cta]', start: 'top 85%' },
      });
    }, rootRef);

    return () => {
      ctx.revert();
      scrollState.progress = 0;
    };
  }, []);

  // anime.js: workflow steps cascade + icon pop when the section scrolls into view
  useEffect(() => {
    const el = workflowRef.current;
    if (!el) return;

    const steps = el.querySelectorAll<HTMLElement>('[data-workflow-step]');
    steps.forEach((s) => { s.style.opacity = '0'; });

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();

        animate(steps, {
          opacity: [0, 1],
          translateX: [-42, 0],
          filter: ['blur(6px)', 'blur(0px)'],
          delay: stagger(150),
          duration: 850,
          ease: 'outExpo',
        });
        animate(el.querySelectorAll('[data-workflow-icon]'), {
          scale: [0, 1],
          rotate: ['-90deg', '0deg'],
          delay: stagger(150, { start: 120 }),
          duration: 700,
          ease: 'outBack(2.2)',
        });
      },
      { threshold: 0.25 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <Navigation />

      {/* Fixed 3D backdrop */}
      <div ref={canvasWrapRef} className="fixed inset-0 z-0">
        <Scene />
      </div>

      {/* ======================= HERO ======================= */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div data-hero-fade className="mb-6">
          <AnimatedGradientText>
            <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accentGreen" />
            <GradientText className="text-xs font-semibold uppercase tracking-[0.3em]" animationSpeed={6}>
              Vanguard OS · Quant Terminal
            </GradientText>
            <ChevronRight size={14} className="ml-1 text-textMuted transition-transform duration-300 group-hover:translate-x-0.5" />
          </AnimatedGradientText>
        </div>

        <h1 className="text-5xl font-black leading-[1.08] tracking-tight sm:text-7xl">
          <SplitText text="Trade with" className="text-gradient" delay={35} />
          <br />
          <SplitText
            text="machine precision."
            className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-400 bg-clip-text text-transparent"
            delay={35}
          />
        </h1>

        <p data-hero-fade className="mt-6 max-w-2xl text-base leading-relaxed text-textSecondary sm:text-lg">
          Systematic entries and stops, institutional risk analytics, global news
          sentiment and an AI copilot — fused into one screener and portfolio manager.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <div data-hero-fade>
            <Link href="/screener">
              <ShimmerButton
                shimmerColor="#34D399"
                background="linear-gradient(110deg, #064E3B 0%, #07090F 45%, #083344 100%)"
                className="px-8 py-3.5 shadow-glowGreen"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-white">
                  Launch Terminal
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </span>
              </ShimmerButton>
            </Link>
          </div>
          <Link
            data-hero-fade
            href="/portfolio"
            className="rounded-full border border-borderSubtle bg-white/[0.04] px-7 py-3.5 text-sm font-semibold text-textPrimary backdrop-blur-md transition-colors hover:border-accentGreen/40"
          >
            View Portfolio
          </Link>
        </div>

        <div data-hero-fade className="absolute bottom-8 flex flex-col items-center gap-2 text-textMuted">
          <ShinyText text="SCROLL" speed={3} className="text-[10px] uppercase tracking-[0.3em]" />
          <div className="h-9 w-[1px] animate-pulse-soft bg-gradient-to-b from-accentGreen to-transparent" />
        </div>
      </section>

      {/* ================= LIVE TICKER TAPE ================= */}
      <section className="relative z-10 border-y border-borderSubtle bg-bgPrimary/60 py-4 backdrop-blur-md">
        <Marquee pauseOnHover className="[--duration:32s] [--gap:0.5rem]">
          {TICKERS_A.map((t) => <TickerChip key={t.symbol} {...t} />)}
        </Marquee>
        <Marquee reverse pauseOnHover className="[--duration:38s] [--gap:0.5rem]">
          {TICKERS_B.map((t) => <TickerChip key={t.symbol} {...t} />)}
        </Marquee>
        {/* edge fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-bgPrimary to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-bgPrimary to-transparent" />
      </section>

      {/* ===================== FEATURES ===================== */}
      <section data-features className="relative z-10 mx-auto max-w-7xl px-6 py-28">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-accentBlue">The stack</p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            <SplitText text="A hedge-fund desk, distilled." className="text-gradient" delay={22} />
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div data-feature-card key={f.title}>
              <Link href={f.href} className="block h-full">
                <SpotlightCard className="h-full p-6 hover-lift" spotlightColor={f.spotlight}>
                  <BorderBeam size={140} duration={10} delay={i * 2.5} colorFrom={f.beamFrom} colorTo={f.beamTo} />
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-borderSubtle bg-white/[0.04]">
                    {f.icon}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-textPrimary">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-textSecondary">{f.desc}</p>
                  <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-accentGreen">
                    Explore <ArrowRight size={12} />
                  </div>
                </SpotlightCard>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ======================= STATS ====================== */}
      <section className="relative z-10 border-y border-borderSubtle bg-bgSecondary/60 backdrop-blur-xl">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-6 py-16 text-center md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="text-4xl font-black text-textPrimary sm:text-5xl">
                <CountUp to={s.value} duration={1.6} prefix={s.prefix ?? ''} suffix={s.suffix} />
              </div>
              <div className="mt-2 text-xs uppercase tracking-wider text-textMuted">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== WORKFLOW ===================== */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-28">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <div ref={workflowRef}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-accentPurple">Workflow</p>
            <h2 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl">
              <GradientText animationSpeed={10} colors={['#F1F5F9', '#A78BFA', '#60A5FA', '#F1F5F9']}>
                Signal → Size → Execute → Manage risk.
              </GradientText>
            </h2>
            <div className="space-y-5">
              {WORKFLOW_STEPS.map((s) => (
                <div key={s.t} data-workflow-step className="flex gap-4 will-change-transform">
                  <div data-workflow-icon className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-borderSubtle bg-white/[0.04]">
                    {s.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-textPrimary">{s.t}</div>
                    <div className="mt-0.5 text-sm leading-relaxed text-textSecondary">{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <TiltCard className="overflow-hidden">
            <BorderBeam size={180} duration={12} colorFrom="#F87171" colorTo="#A78BFA" />
            <div className="space-y-3 font-mono text-[13px]">
              <div className="flex items-center justify-between border-b border-borderSubtle pb-3">
                <span className="font-bold text-textPrimary">AAPL · Quant Plan</span>
                <span className="rounded bg-red-400/10 px-2 py-0.5 text-[11px] font-bold text-accentRed">SELL −0.34</span>
              </div>
              {[
                ['Entry (limit)', '$308.63', 'text-accentBlue'],
                ['Stop loss', '$324.35', 'text-accentRed'],
                ['Target 1 · 1.5R', '$285.04', 'text-accentGreen'],
                ['Target 2 · 3R', '$261.46', 'text-accentGreen'],
                ['Kelly allocation', '3.8% of equity', 'text-accentCyan'],
                ['Win rate (1y)', '52.8%', 'text-textPrimary'],
              ].map(([k, v, c]) => (
                <div key={k as string} className="flex items-center justify-between">
                  <span className="text-textMuted">{k}</span>
                  <span className={`tabular font-semibold ${c}`}>{v}</span>
                </div>
              ))}
              <p className="pt-2 text-[10px] text-textMuted">Live output from the signal engine · educational, not advice</p>
            </div>
          </TiltCard>
        </div>
      </section>

      {/* ======================== CTA ======================= */}
      <section className="relative z-10 px-6 pb-32 pt-10">
        <div
          data-cta
          className="glass-panel relative mx-auto flex max-w-4xl flex-col items-center gap-6 overflow-hidden rounded-3xl p-14 text-center"
        >
          <Meteors number={24} />
          <BorderBeam size={220} duration={14} colorFrom="#34D399" colorTo="#60A5FA" />
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            <SplitText text="Your desk is ready." className="text-gradient" delay={30} />
          </h2>
          <p className="max-w-xl text-textSecondary">
            <ShinyText
              text="$100k in paper capital, a full quant stack, and an AI that knows your book. No risk. All signal."
              speed={6}
            />
          </p>
          <Link href="/screener" className="mt-2">
            <ShimmerButton
              shimmerColor="#22D3EE"
              background="linear-gradient(110deg, #064E3B 0%, #07090F 45%, #083344 100%)"
              className="px-9 py-4 shadow-glowGreen"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-white">
                Open Vanguard OS
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </span>
            </ShimmerButton>
          </Link>
        </div>
      </section>
    </div>
  );
}
