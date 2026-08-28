import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion, DUR } from './motion';

/** Decelerate curve (approx cubic-bezier(.16,1,.3,1)) as a scalar ramp. */
function easeDecel(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Tween a number towards `target` over ~300–500ms whenever it changes,
 * instead of snapping. Honours prefers-reduced-motion (snaps). The first
 * value rendered is never animated (there is nothing to morph from).
 *
 * Implementation notes: no refs are read during render and no setState runs
 * synchronously in an effect body — the per-frame updates happen inside
 * requestAnimationFrame, which keeps the strict React lint rules happy.
 */
export function useAnimatedNumber(target: number, durationMs: number = DUR.number): number {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  const firstRef = useRef(true);

  // Keep a live handle on the last painted value so the next tween starts
  // from where this one stopped (not from a stale `target`).
  useEffect(() => { shownRef.current = shown; }, [shown]);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      shownRef.current = target;
      return;
    }
    const from = shownRef.current;
    if (from === target || !Number.isFinite(target)) {
      shownRef.current = target;
      return;
    }
    const dur = prefersReducedMotion() ? 0 : durationMs;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = dur <= 0 ? 1 : Math.min(1, (now - start) / dur);
      const v = from + (target - from) * easeDecel(t);
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return shown;
}
