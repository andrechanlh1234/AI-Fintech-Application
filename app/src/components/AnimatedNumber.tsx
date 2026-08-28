import { type CSSProperties } from 'react';
import { useAnimatedNumber } from '../lib/useAnimatedNumber';
import { DUR, EASE_DECEL } from '../lib/motion';

/**
 * Reusable animated figure (spec §6). `value` is the raw number; `format`
 * turns the in-flight value into the string shown (defaults to a 2dp
 * en-MY string). `prefix`/`suffix` render outside the tween so a currency
 * symbol never counts. Snaps under prefers-reduced-motion.
 */
export function AnimatedNumber({
  value, format, prefix, suffix, className, style, durationMs,
}: {
  value: number;
  format?: (n: number) => string;
  prefix?: string;
  suffix?: string;
  className?: string;
  style?: CSSProperties;
  durationMs?: number;
}) {
  const shown = useAnimatedNumber(value, durationMs);
  const fmt = format ?? ((n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  return (
    <span
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums', transition: `color ${DUR.micro}ms ${EASE_DECEL}`, ...style }}
    >
      {prefix}{fmt(shown)}{suffix}
    </span>
  );
}
