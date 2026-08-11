'use client';

import React, { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';

interface CountUpProps {
  to: number;
  from?: number;
  direction?: 'up' | 'down';
  delay?: number; // seconds
  duration?: number; // seconds
  className?: string;
  startWhen?: boolean;
  separator?: string;
  prefix?: string;
  suffix?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

export default function CountUp({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 2,
  className = '',
  startWhen = true,
  separator = ',',
  prefix = '',
  suffix = '',
  onStart,
  onEnd,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(direction === 'down' ? to : from);

  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);
  const springValue = useSpring(motionValue, { damping, stiffness });
  const isInView = useInView(ref, { once: true, margin: '0px' });

  const format = (value: number) => {
    const rounded = Math.round(value);
    const formatted = separator
      ? new Intl.NumberFormat('en-US', { useGrouping: true })
          .format(rounded)
          .replace(/,/g, separator)
      : String(rounded);
    return `${prefix}${formatted}${suffix}`;
  };

  useEffect(() => {
    if (ref.current) ref.current.textContent = format(direction === 'down' ? to : from);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, direction]);

  useEffect(() => {
    if (!isInView || !startWhen) return;
    // Reduced motion: show the final number immediately — manual motion values
    // bypass MotionConfig, so this must be gated here explicitly.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (ref.current) ref.current.textContent = format(direction === 'down' ? from : to);
      onStart?.();
      onEnd?.();
      return;
    }
    onStart?.();
    const timeout = setTimeout(() => {
      motionValue.set(direction === 'down' ? from : to);
    }, delay * 1000);
    const endTimeout = setTimeout(() => onEnd?.(), delay * 1000 + duration * 1000);
    return () => {
      clearTimeout(timeout);
      clearTimeout(endTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInView, startWhen, motionValue, direction, from, to, delay, duration]);

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      if (ref.current) ref.current.textContent = format(latest);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [springValue, separator, prefix, suffix]);

  return <span className={`tabular ${className}`} ref={ref} />;
}
