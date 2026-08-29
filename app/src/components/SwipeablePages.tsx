import { useRef, type ReactNode, type PointerEvent as ReactPointerEvent, type TransitionEvent as ReactTransitionEvent } from 'react';
import { prefersReducedMotion } from '../lib/motion';

/**
 * Horizontal swipe between the top-level tabs, in the tab-bar order
 * (Home, Finance, Tax, AI). Only the current page is mounted, so the drag
 * moves that one page under the finger; on a committed swipe it hands the
 * incoming page's motion to PageTransition and springs the wrapper home
 * from wherever the finger let go, so the two read as one continuous move.
 *
 * Performance + robustness notes (this replaced a version that re-rendered
 * the whole app tree on every pointermove, which is what made it "glitchy"):
 *  - the drag transform is written straight to the node's style, never
 *    through React state — zero re-renders during a swipe.
 *  - touch / pen only. A mouse drag never navigates (desktop uses the tab
 *    bar), so stray click-drags can't fire it.
 *  - `touch-action: pan-y` keeps vertical scrolling native; the gesture only
 *    engages once movement is clearly horizontal.
 *  - a press that begins inside a horizontally-scrollable strip (chip rows,
 *    charts) or anything marked `data-no-swipe` is ignored.
 *  - the spring-back transition is armed with a forced reflow before the
 *    transform changes, so it always animates instead of snapping.
 *  - prefers-reduced-motion: no drag transform, just the navigation.
 */

const SETTLE = 'transform .28s cubic-bezier(.22,1,.28,1)';

export function SwipeablePages({
  index, count, onNavigate, disabled = false, children,
}: {
  index: number;
  count: number;
  onNavigate: (nextIndex: number) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const el = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<'?' | 'h' | 'v'>('?');
  const dx = useRef(0);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const vel = useRef(0);

  const paint = (x: number) => {
    const n = el.current;
    if (!n) return;
    n.style.transform = x ? `translate3d(${x}px,0,0)` : '';
  };

  // Spring the wrapper back to rest, guaranteeing the transition actually
  // runs (set it, force a reflow, then change the value).
  const springHome = () => {
    const n = el.current;
    if (!n) return;
    if (prefersReducedMotion()) { n.style.transition = 'none'; n.style.transform = ''; n.style.willChange = ''; return; }
    n.style.transition = SETTLE;
    void n.offsetWidth; // eslint-disable-line no-unused-expressions -- forced reflow
    n.style.transform = '';
    n.style.willChange = 'transform';
  };

  const finish = (target: number | null) => {
    axis.current = '?';
    if (target !== null) onNavigate(target);
    springHome();
  };

  const blocked = (target: EventTarget | null): boolean => {
    let node = target as HTMLElement | null;
    while (node && node !== el.current) {
      if (node.dataset && node.dataset.noSwipe !== undefined) return true;
      const s = window.getComputedStyle(node);
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && node.scrollWidth > node.clientWidth + 1) return true;
      node = node.parentElement;
    }
    return false;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || (e.pointerType !== 'touch' && e.pointerType !== 'pen')) return;
    if (blocked(e.target)) return;
    startX.current = lastX.current = e.clientX;
    startY.current = e.clientY;
    lastT.current = e.timeStamp;
    vel.current = 0;
    dx.current = 0;
    axis.current = '?';
    if (el.current) el.current.style.transition = 'none';
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (axis.current === 'v') return;
    if (axis.current === '?') {
      const mx = e.clientX - startX.current;
      const my = e.clientY - startY.current;
      if (Math.abs(mx) < 14 && Math.abs(my) < 14) return;
      if (Math.abs(my) >= Math.abs(mx)) { axis.current = 'v'; return; } // vertical — let the page scroll
      axis.current = 'h';
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
      if (el.current) el.current.style.willChange = 'transform';
    }

    const dt = e.timeStamp - lastT.current;
    if (dt > 0) vel.current = (e.clientX - lastX.current) / dt;
    lastX.current = e.clientX;
    lastT.current = e.timeStamp;

    let d = e.clientX - startX.current;
    if ((d > 0 && index === 0) || (d < 0 && index === count - 1)) d *= 0.35; // rubber-band at the ends
    dx.current = d;
    if (!prefersReducedMotion()) paint(d);
    e.preventDefault();
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (axis.current !== 'h') { axis.current = '?'; return; }
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
    const width = el.current?.offsetWidth || 1;
    const d = dx.current;
    const target = d > 0 ? index - 1 : index + 1;
    const commit = (Math.abs(d) > width * 0.25 || Math.abs(vel.current) > 0.45)
      && target >= 0 && target < count;
    finish(commit ? target : null);
  };

  const onPointerCancel = () => {
    if (axis.current === 'h') springHome();
    axis.current = '?';
  };

  // Clear the transition/hint once the spring settles (guard against
  // transitionend bubbling up from a child).
  const onTransitionEnd = (e: ReactTransitionEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.propertyName === 'transform' && el.current) {
      el.current.style.transition = 'none';
      el.current.style.willChange = '';
    }
  };

  return (
    <div
      ref={el}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onTransitionEnd={onTransitionEnd}
      style={{ touchAction: 'pan-y' }}
    >
      {children}
    </div>
  );
}
