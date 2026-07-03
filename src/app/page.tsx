'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Environment, Preload } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  Crosshair, ShieldAlert, Newspaper, Bot, ArrowRight, LineChart, Globe2, Braces,
} from 'lucide-react';
import Navigation from '../components/Navigation';

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
function TiltCard({ children }: { children: React.ReactNode }) {
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
      className="glass-panel h-full p-6"
    >
      <div style={{ transform: 'translateZ(28px)', transformStyle: 'preserve-3d' }}>
        {children}
      </div>
    </motion.div>
  );
}

const FEATURES = [
  {
    icon: <Crosshair size={22} className="text-accentGreen" />,
    title: 'Quant Trade Plans',
    desc: 'Five-factor systematic engine — OU mean reversion, momentum, VWAP, order-flow, RSI — voting into executable entry, ATR stop and R-multiple targets with half-Kelly sizing.',
    href: '/screener',
  },
  {
    icon: <ShieldAlert size={22} className="text-accentRed" />,
    title: 'Institutional Risk',
    desc: '95% VaR & expected shortfall in dollars, Sharpe, Sortino, max drawdown, beta and diversification scoring — recomputed live on your portfolio.',
    href: '/portfolio',
  },
  {
    icon: <Newspaper size={22} className="text-accentBlue" />,
    title: 'Global News Sentiment',
    desc: 'Headlines across 8 market categories scored with NLP in real time, aggregated into fear/greed mood indices per region and asset class.',
    href: '/news',
  },
  {
    icon: <Bot size={22} className="text-accentPurple" />,
    title: 'AI Copilot',
    desc: 'A portfolio-aware assistant grounded in your live positions, quant signals and news flow. Ask it anything — it cites real numbers, not vibes.',
    href: '/screener',
  },
];

const STATS = [
  { value: 5, suffix: '', label: 'Alpha factor families' },
  { value: 12, suffix: '+', label: 'Risk & return metrics' },
  { value: 8, suffix: '', label: 'News categories scored' },
  { value: 100, suffix: 'k', label: 'Paper capital to master', prefix: '$' },
];

/* ================================ PAGE =================================== */

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

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

      // Hero intro
      gsap.from('[data-hero-line]', {
        yPercent: 110,
        opacity: 0,
        duration: 1.1,
        stagger: 0.14,
        ease: 'power4.out',
        delay: 0.15,
      });
      gsap.from('[data-hero-cta]', {
        y: 24, opacity: 0, duration: 0.9, stagger: 0.1, delay: 0.9, ease: 'power3.out',
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

      // Stat counters
      gsap.utils.toArray<HTMLElement>('[data-counter]').forEach((el) => {
        const target = Number(el.dataset.counter);
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 1.6,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 88%' },
          onUpdate: () => { el.textContent = String(Math.round(obj.v)); },
        });
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

  return (
    <div ref={rootRef} className="relative">
      <Navigation />

      {/* Fixed 3D backdrop */}
      <div ref={canvasWrapRef} className="fixed inset-0 z-0">
        <Scene />
      </div>

      {/* ======================= HERO ======================= */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="overflow-hidden">
          <p data-hero-line className="mb-4 text-xs font-semibold uppercase tracking-[0.35em] text-accentGreen">
            Vanguard OS · Quant Terminal
          </p>
        </div>
        <div className="overflow-hidden">
          <h1 data-hero-line className="text-5xl font-black leading-[1.05] tracking-tight text-gradient sm:text-7xl">
            Trade with
          </h1>
        </div>
        <div className="overflow-hidden">
          <h1 data-hero-line className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-400 bg-clip-text text-5xl font-black leading-[1.05] tracking-tight text-transparent sm:text-7xl">
            machine precision.
          </h1>
        </div>
        <div className="overflow-hidden">
          <p data-hero-line className="mt-6 max-w-2xl text-base leading-relaxed text-textSecondary sm:text-lg">
            Systematic entries and stops, institutional risk analytics, global news
            sentiment and an AI copilot — fused into one screener and portfolio manager.
          </p>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            data-hero-cta
            href="/screener"
            className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-7 py-3.5 text-sm font-bold text-black shadow-glowGreen transition-all hover:brightness-110"
          >
            Launch Terminal
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            data-hero-cta
            href="/portfolio"
            className="rounded-full border border-borderSubtle bg-white/[0.04] px-7 py-3.5 text-sm font-semibold text-textPrimary backdrop-blur-md transition-colors hover:border-accentGreen/40"
          >
            View Portfolio
          </Link>
        </div>
        <div data-hero-cta className="absolute bottom-8 flex flex-col items-center gap-2 text-textMuted">
          <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
          <div className="h-9 w-[1px] animate-pulse-soft bg-gradient-to-b from-accentGreen to-transparent" />
        </div>
      </section>

      {/* ===================== FEATURES ===================== */}
      <section data-features className="relative z-10 mx-auto max-w-7xl px-6 py-28">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-accentBlue">The stack</p>
          <h2 className="text-3xl font-bold tracking-tight text-gradient sm:text-5xl">
            A hedge-fund desk, distilled.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map((f) => (
            <div data-feature-card key={f.title}>
              <Link href={f.href} className="block h-full">
                <TiltCard>
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-borderSubtle bg-white/[0.04]">
                    {f.icon}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-textPrimary">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-textSecondary">{f.desc}</p>
                  <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-accentGreen">
                    Explore <ArrowRight size={12} />
                  </div>
                </TiltCard>
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
              <div className="text-4xl font-black tabular text-textPrimary sm:text-5xl">
                {s.prefix}<span data-counter={s.value}>0</span>{s.suffix}
              </div>
              <div className="mt-2 text-xs uppercase tracking-wider text-textMuted">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== WORKFLOW ===================== */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-28">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-accentPurple">Workflow</p>
            <h2 className="mb-6 text-3xl font-bold tracking-tight text-gradient sm:text-4xl">
              Signal → Size → Execute → Manage risk.
            </h2>
            <div className="space-y-5">
              {[
                { icon: <LineChart size={16} className="text-accentGreen" />, t: 'Screen', d: 'Multi-factor composite scores every ticker with entry, stop and targets drawn on the chart.' },
                { icon: <Braces size={16} className="text-accentCyan" />, t: 'Size', d: 'Half-Kelly, conviction-scaled position sizing caps your exposure before you click buy.' },
                { icon: <Globe2 size={16} className="text-accentBlue" />, t: 'Context', d: 'Global news mood, ML forecasts and macro geotrade views frame every decision.' },
                { icon: <ShieldAlert size={16} className="text-accentRed" />, t: 'Manage', d: 'Portfolio VaR, drawdown and correlation update as positions move — with an AI to explain it all.' },
              ].map((s) => (
                <div key={s.t} className="flex gap-4">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-borderSubtle bg-white/[0.04]">
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
          <TiltCard>
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
          className="glass-panel mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-3xl p-14 text-center"
          style={{ borderTop: '2px solid #34D399' }}
        >
          <h2 className="text-3xl font-bold tracking-tight text-gradient sm:text-5xl">
            Your desk is ready.
          </h2>
          <p className="max-w-xl text-textSecondary">
            $100k in paper capital, a full quant stack, and an AI that knows your book.
            No risk. All signal.
          </p>
          <Link
            href="/screener"
            className="group mt-2 flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-8 py-4 text-sm font-bold text-black shadow-glowGreen transition-all hover:brightness-110"
          >
            Open Vanguard OS
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>
    </div>
  );
}
