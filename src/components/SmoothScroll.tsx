'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import usePrefersReducedMotion from '../lib/useReducedMotion';

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis smooth-scroll provider driven by the GSAP ticker and wired into
 * ScrollTrigger.
 *
 * Replaces the previous locomotive-scroll rig. Locomotive transforms a scroll
 * container, which forced a scrollerProxy, broke position:fixed for anything
 * inside it, and left window.scrollY pinned at 0 (so the nav needed a custom
 * 'app:scroll' event to know it had scrolled). Lenis drives NATIVE scroll
 * position instead: window.scrollY stays truthful, fixed elements work, and
 * every ScrollTrigger reads the default scroller with no proxy.
 *
 * Falls back to native scroll under prefers-reduced-motion — Lenis is never
 * instantiated, so there is no smoothing to fight.
 */
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    let disposed = false;
    let lenis: import('lenis').default | null = null;
    let raf: ((time: number) => void) | null = null;

    (async () => {
      try {
        const Lenis = (await import('lenis')).default;
        if (disposed) return;

        lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
        lenis.on('scroll', ScrollTrigger.update);

        // GSAP's ticker drives Lenis so both run on one rAF loop instead of two
        // competing ones. lagSmoothing(0) keeps scrub tweens locked to scroll
        // position even when the main thread stalls.
        raf = (time: number) => lenis?.raf(time * 1000);
        gsap.ticker.add(raf);
        gsap.ticker.lagSmoothing(0);
        ScrollTrigger.refresh();
      } catch {
        // Chunk failed to load: native scroll is a perfectly good fallback and
        // every trigger already targets the default scroller.
      }
    })();

    return () => {
      disposed = true;
      if (raf) gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
      lenis?.destroy();
      ScrollTrigger.refresh();
    };
  }, [reducedMotion]);

  return <>{children}</>;
}
