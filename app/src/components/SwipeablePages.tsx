import { useLayoutEffect, useRef, type ReactNode, type PointerEvent as ReactPointerEvent, type TransitionEvent as ReactTransitionEvent } from 'react';
import { prefersReducedMotion } from '../lib/motion';

/**
 * Horizontal swipe between the top-level tabs, in tab-bar order
 * (Home, Finance, Tax, AI). Only the current page is mounted, so the drag
 * moves that one page under the finger; a committed swipe drops the drag
 * transform and lets PageTransition slide the incoming page in.
 *
 * Things that were making the earlier version stick / feel glitchy, and
 * what fixed them:
 *  - it only covered the content-height area, so a swipe started low on a
 *    short page hit dead space → the wrapper is now `100dvh - tab-bar`.
 *  - it called `setPointerCapture` on touch, which on iOS WebKit can stop
 *    `pointermove` firing mid-drag → removed (touch pointers capture
 *    implicitly anyway).
 *  - it drove the transform through React state, re-rendering the whole app
 *    tree per move → the transform is now written straight to the node.
 *  - the spring-back could be armed in the same frame as the value change
 *    and never run → forced reflow between the two.
 *  - a cancelled gesture could leave a stale transform → `pointercancel`
 *    and every tab change now hard-reset it.
 *
 * Touch / pen only (desktop uses the tab bar). `touch-action: pan-y` keeps
 * vertical scrolling native; the gesture only takes over once movement is
 * clearly horizontal, and never when it starts on a horizontally
 * scrollable strip or anything marked `data-no-swipe`. A screen with its
 * own nested scroll container must also set `touch-action: pan-y` on it, or
 * WebKit claims (then cancels) the horizontal drag and the swipe dies on
 * that tab. Off while an overlay is open; honours reduced-motion.
 */

const SETTLE = 'transform .26s cubic-bezier(.22,1,.28,1)';

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
  const g = useRef({
    startX: 0, startY: 0, lastX: 0, lastT: 0, vel: 0, dx: 0,
    axis: 'idle' as 'idle' | 'undecided' | 'h' | 'v',
    reduce: false,
  });

  // After a committed swipe `index` changes and the pane remounts via
  // PageTransition — make certain no drag transform is left on the wrapper.
  useLayoutEffect(() => {
    const n = el.current;
    if (n && g.current.axis !== 'h') { n.style.transform = ''; n.style.transition = ''; n.style.willChange = ''; }
  }, [index]);

  const rest = (animate: boolean) => {
    const n = el.current;
    g.current.axis = 'idle';
    if (!n) return;
    if (animate && !g.current.reduce) {
      n.style.transition = SETTLE;
      void n.offsetWidth;               // force reflow so the transition actually runs
      n.style.transform = '';
    } else {
      n.style.transition = 'none';
      n.style.transform = '';
      n.style.willChange = '';
    }
  };

  const startsOnScrollable = (t: EventTarget | null) => {
    let node = t as HTMLElement | null;
    while (node && node !== el.current) {
      if (node.dataset && node.dataset.noSwipe !== undefined) return true;
      const s = getComputedStyle(node);
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && node.scrollWidth > node.clientWidth + 1) return true;
      node = node.parentElement;
    }
    return false;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || (e.pointerType !== 'touch' && e.pointerType !== 'pen')) return;
    if (startsOnScrollable(e.target)) return;
    const s = g.current;
    s.startX = s.lastX = e.clientX;
    s.startY = e.clientY;
    s.lastT = e.timeStamp;
    s.vel = 0; s.dx = 0;
    s.axis = 'undecided';
    s.reduce = prefersReducedMotion();
    if (el.current) el.current.style.transition = 'none';
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = g.current;
    if (s.axis === 'idle' || s.axis === 'v') return;

    const mx = e.clientX - s.startX;
    const my = e.clientY - s.startY;

    if (s.axis === 'undecided') {
      if (Math.abs(mx) < 12 && Math.abs(my) < 12) return;
      if (Math.abs(mx) <= Math.abs(my)) { s.axis = 'v'; return; }   // vertical — leave it to native scroll
      s.axis = 'h';
      if (el.current) el.current.style.willChange = 'transform';
    }

    const dt = e.timeStamp - s.lastT;
    if (dt > 0) s.vel = (e.clientX - s.lastX) / dt;
    s.lastX = e.clientX;
    s.lastT = e.timeStamp;

    let d = mx;
    if ((d > 0 && index === 0) || (d < 0 && index === count - 1)) d *= 0.35;   // rubber-band at the ends
    s.dx = d;
    if (!s.reduce && el.current) el.current.style.transform = `translate3d(${d}px,0,0)`;
  };

  const onPointerUp = () => {
    const s = g.current;
    if (s.axis !== 'h') { rest(false); return; }
    const w = el.current?.offsetWidth || 1;
    const target = s.dx > 0 ? index - 1 : index + 1;
    const commit = (Math.abs(s.dx) > w * 0.22 || Math.abs(s.vel) > 0.4) && target >= 0 && target < count;
    if (commit) {
      rest(false);            // drop our transform instantly — PageTransition owns the incoming slide
      onNavigate(target);
    } else {
      rest(true);             // spring back to centre
    }
  };

  const onPointerCancel = () => { rest(false); };

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
      style={{ minHeight: 'calc(100dvh - 104px)', touchAction: 'pan-y' }}
    >
      {children}
    </div>
  );
}
