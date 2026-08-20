'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import usePrefersReducedMotion from '../../lib/useReducedMotion';

interface MagneticProps {
  children: React.ReactNode;
  /** 0..1 fraction of the cursor offset applied to the element. */
  strength?: number;
  className?: string;
}

/**
 * Magnetic hover wrapper: the element eases toward the cursor while hovered and
 * springs back on leave.
 *
 * No-op under reduced motion and on touch-only devices — a magnetic pull with no
 * pointer to follow is just an element that never settles. Uses gsap.quickTo so
 * pointer movement never touches React state.
 */
export default function Magnetic({ children, strength = 0.3, className }: MagneticProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [finePointer, setFinePointer] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(hover: hover) and (pointer: fine)');
    setFinePointer(mql.matches);
    const onChange = () => setFinePointer(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion || !finePointer || !ref.current) return;
    const el = ref.current;

    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      xTo((e.clientX - (rect.left + rect.width / 2)) * strength);
      yTo((e.clientY - (rect.top + rect.height / 2)) * strength);
    };
    const onLeave = () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      gsap.killTweensOf(el);
      gsap.set(el, { x: 0, y: 0 });
    };
  }, [reducedMotion, finePointer, strength]);

  return (
    <div ref={ref} className={`inline-block ${className ?? ''}`}>
      {children}
    </div>
  );
}
