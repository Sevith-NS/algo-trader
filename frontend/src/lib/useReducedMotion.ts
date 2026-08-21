'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

/**
 * SSR-safe prefers-reduced-motion hook (hard a11y requirement — see CLAUDE.md).
 * Server snapshot is `false` so markup hydrates identically; the real value
 * applies on the client before any animation effect runs.
 */
export default function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** Imperative check for non-hook contexts (GSAP/anime effects). */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
