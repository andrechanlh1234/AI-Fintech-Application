import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent, type TransitionEvent as ReactTransitionEvent } from 'react';
import { prefersReducedMotion } from '../lib/motion';

/**
 * A real horizontal pager for the top-level tabs (Home, Finance, Tax, AI).
 *
 * Both the outgoing and the incoming page are mounted side by side in a
 * track and the track moves as one, so a swipe — or a tab-bar tap — reads
 * as the current page sliding off while the next slides on, joined at the
 * edge. Off-screen pages are only mounted while a gesture or slide is in
 * flight; the rest of the time it's a single pane and the track is inert.
 *
 * Notes from the version that felt disjointed / stuck:
 *  - only one page was mounted, so a committed swipe just swapped the
 *    content and let a separate 14px slide play — the incoming page
 *    "appeared" instead of arriving connected. Now it's a shared track.
 *  - `setPointerCapture` on touch can make WebKit drop `pointermove`
 *    mid-drag; a nested scroll container with the default `touch-action`
 *    made WebKit cancel the whole gesture. Neither is used here, and each
 *    scroll container sets `touch-action: pan-y` itself.
 *
 * Touch / pen only (desktop taps the bar). `touch-action: pan-y` keeps
 * vertical scrolling native; the gesture engages only once movement is
 * clearly horizontal, never on a horizontally-scrollable strip or anything
 * marked `data-no-swipe`. Disabled while a full-screen overlay is open;
 * honours reduced-motion.
 */

const SLIDE = 'transform .32s cubic-bezier(.3,.72,.15,1)';

export function SwipeablePages({
  index, count, renderPage, onIndexChange, disabled = false,
}: {
  index: number;
  count: number;
  renderPage: (i: number, active: boolean) => ReactNode;
  onIndexChange: (i: number) => void;
  disabled?: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  // `base` is the settled tab. `peek` is the neighbour mounted alongside it
  // while a drag or a slide is running (null the rest of the time).
  const [base, setBase] = useState(index);
  const [peek, setPeek] = useState<number | null>(null);

  const anim = useRef(false);       // a slide transition is playing
  const pending = useRef(index);    // where that slide is heading
  const g = useRef({
    x0: 0, y0: 0, lx: 0, lt: 0, v: 0, dx: 0, w: 1,
    axis: 'idle' as 'idle' | 'undecided' | 'h' | 'v',
    dir: 0, reduce: false,
  });

  const order = (): number[] => {
    if (peek == null) return [base];
    return peek > base ? [base, peek] : [peek, base];
  };

  const setX = (px: number, animate: boolean) => {
    const t = track.current;
    if (!t) return;
    t.style.transition = animate ? SLIDE : 'none';
    t.style.transform = `translate3d(${px}px,0,0)`;
  };
  const restX = () => -order().indexOf(base) * g.current.w;
  const slotX = (i: number) => -order().indexOf(i) * g.current.w;

  const finish = (target: number) => {
    anim.current = false;
    g.current.dx = 0;
    g.current.axis = 'idle';
    if (track.current) track.current.style.willChange = '';
    if (target !== base) {
      setBase(target);
      if (target !== index) onIndexChange(target);
    }
    setPeek(null);
    setX(0, false);
  };

  const glideTo = (target: number, fromDrag: boolean) => {
    const clamped = Math.max(0, Math.min(count - 1, target));
    g.current.w = viewport.current?.offsetWidth || 1;
    anim.current = true;
    pending.current = clamped;
    // Fallback: if the transform doesn't actually change (finger dragged
    // the whole way), `transitionend` never fires — don't freeze the pager.
    window.setTimeout(() => { if (anim.current && pending.current === clamped) finish(clamped); }, 420);

    if (clamped === base) {                       // cancelled — settle back to centre
      if (g.current.reduce || !track.current) { finish(base); return; }
      track.current.style.transition = SLIDE;
      void track.current.offsetWidth;
      setX(restX(), true);
      return;
    }

    setPeek(clamped);                             // ensure both panes are mounted + ordered
    const armAndRun = () => {
      if (g.current.reduce || !track.current) { finish(clamped); return; }
      if (!fromDrag) setX(slotX(base), false);    // a tap starts from base centred
      track.current.style.transition = SLIDE;
      void track.current.offsetWidth;             // commit the start position before animating
      setX(slotX(clamped), true);
    };
    // freshly-mounted peek pane needs a layout pass first; a drag is already painted
    if (fromDrag) requestAnimationFrame(armAndRun);
    else requestAnimationFrame(() => requestAnimationFrame(armAndRun));
  };

  // Tab-bar tap / programmatic tab change → slide to it.
  useEffect(() => {
    if (index === base || anim.current) return;
    g.current.reduce = prefersReducedMotion();
    glideTo(index, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const onTransitionEnd = (e: ReactTransitionEvent<HTMLDivElement>) => {
    if (e.target !== track.current || e.propertyName !== 'transform' || !anim.current) return;
    finish(pending.current);
  };

  const startsOnScrollable = (t: EventTarget | null) => {
    let n = t as HTMLElement | null;
    while (n && n !== viewport.current) {
      if (n.dataset && n.dataset.noSwipe !== undefined) return true;
      const s = getComputedStyle(n);
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true;
      n = n.parentElement;
    }
    return false;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || anim.current || (e.pointerType !== 'touch' && e.pointerType !== 'pen')) return;
    if (startsOnScrollable(e.target)) return;
    const s = g.current;
    s.x0 = s.lx = e.clientX; s.y0 = e.clientY; s.lt = e.timeStamp;
    s.v = 0; s.dx = 0; s.dir = 0; s.axis = 'undecided';
    s.w = viewport.current?.offsetWidth || 1;
    s.reduce = prefersReducedMotion();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = g.current;
    if (s.axis === 'idle' || s.axis === 'v') return;
    const mx = e.clientX - s.x0;
    const my = e.clientY - s.y0;

    if (s.axis === 'undecided') {
      if (Math.abs(mx) < 12 && Math.abs(my) < 12) return;
      if (Math.abs(mx) <= Math.abs(my)) { s.axis = 'v'; return; } // vertical — leave it to the page
      s.axis = 'h';
      s.dir = mx < 0 ? 1 : -1;                 // swipe left → go to next
      const nb = base + s.dir;
      setPeek(nb >= 0 && nb < count ? nb : null);
      if (track.current) track.current.style.willChange = 'transform';
    }

    const dt = e.timeStamp - s.lt;
    if (dt > 0) s.v = (e.clientX - s.lx) / dt;
    s.lx = e.clientX; s.lt = e.timeStamp;

    const edge = (base + s.dir < 0 || base + s.dir >= count);
    s.dx = edge ? mx * 0.35 : mx;               // rubber-band past the ends
    if (!s.reduce) setX(restX() + s.dx, false);
  };

  const onPointerUp = () => {
    const s = g.current;
    if (s.axis !== 'h') { s.axis = 'idle'; return; }
    const target = base + s.dir;
    const moved = Math.abs(s.dx);
    const commit = (moved > s.w * 0.22 || (Math.abs(s.v) > 0.4 && moved > 10))
      && target >= 0 && target < count;
    glideTo(commit ? target : base, true);
  };

  const onPointerCancel = () => {
    const s = g.current;
    if (s.axis === 'h') glideTo(base, true);
    else s.axis = 'idle';
  };

  const moving = peek != null;
  const panes = order();

  return (
    <div
      ref={viewport}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={{
        position: 'relative',
        overflowX: moving ? 'hidden' : undefined,
        minHeight: 'calc(100dvh - 104px)',
        touchAction: 'pan-y',
      }}
    >
      <div
        ref={track}
        onTransitionEnd={onTransitionEnd}
        style={{ position: 'relative', minHeight: 'inherit', transform: moving ? undefined : 'none' }}
      >
        {panes.map((i, k) => (
          <div
            key={i}
            style={{
              position: k === 0 ? 'relative' : 'absolute',
              top: 0, left: `${k * 100}%`, width: '100%',
              minHeight: 'calc(100dvh - 104px)',
            }}
          >
            {renderPage(i, i === base && !moving)}
          </div>
        ))}
      </div>
    </div>
  );
}
