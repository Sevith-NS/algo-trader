'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import usePrefersReducedMotion from '../../lib/useReducedMotion';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface VelocityMarqueeProps {
  children: React.ReactNode;
  /** px per second of base drift. */
  baseSpeed?: number;
  className?: string;
}

const COPIES = 4;

/**
 * Full-bleed horizontal marquee whose direction and speed are modulated by
 * scroll velocity, driven off the GSAP ticker (no scroll listener).
 *
 * Static under reduced motion. Duplicate copies are aria-hidden so the strip
 * is announced once.
 */
export default function VelocityMarquee({
  children,
  baseSpeed = 60,
  className,
}: VelocityMarqueeProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    if (reducedMotion || !trackRef.current) return;
    const track = trackRef.current;

    let x = 0;
    let direction = 1;
    let lastScrollY = window.scrollY;
    let boost = 0;

    const tick = (_t: number, deltaMs: number) => {
      const segment = track.scrollWidth / COPIES;
      if (!segment) return;

      const scrollY = window.scrollY;
      const velocity = scrollY - lastScrollY;
      lastScrollY = scrollY;

      if (velocity > 0.5) direction = 1;
      else if (velocity < -0.5) direction = -1;

      // Velocity boost decays back toward zero so the strip settles.
      boost = gsap.utils.clamp(0, 4, boost * 0.92 + Math.abs(velocity) * 0.02);

      x -= direction * baseSpeed * (1 + boost) * (deltaMs / 1000);
      gsap.set(track, { x: gsap.utils.wrap(-segment, 0, x) });
    };

    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      gsap.set(track, { x: 0 });
    };
  }, [reducedMotion, baseSpeed]);

  return (
    <div className={`overflow-hidden whitespace-nowrap ${className ?? ''}`}>
      <div ref={trackRef} className="inline-flex w-max will-change-transform">
        {Array.from({ length: COPIES }, (_, i) => (
          <div key={i} aria-hidden={i > 0} className="inline-flex shrink-0">
            {children}
          </div>
        ))}
      </div>
    </div>
  );
}
