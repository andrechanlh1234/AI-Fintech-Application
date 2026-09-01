import { useEffect, useRef, useState, type ReactNode } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type { EmblaOptionsType } from 'embla-carousel';
import { prefersReducedMotion } from '../lib/motion';

/**
 * The horizontal pager for the top-level tabs (Home, Finance, Tax, AI),
 * built on Embla Carousel rather than hand-rolled.
 *
 * Two hand-rolled versions of this shipped before Embla: one dropped every
 * frame through React state (re-rendering the whole app tree per
 * pointermove — the "glitchy" one), the next fixed that but still needed a
 * `useLayoutEffect` dance to avoid a one-frame flash whenever the
 * neighbour pane (dis)appeared. Embla's drag handling and its
 * velocity/friction scroll physics run entirely off the render cycle —
 * genuinely 60fps (120 on ProMotion), and immune to that whole class of
 * bug by construction.
 *
 * All four tabs stay mounted (Embla's normal mode). `renderPage`'s `active`
 * flag still tells AiChat which copy is the one actually in view so an
 * off-screen mount never grabs keyboard focus.
 *
 * IMPORTANT: the options object and every function inside it are created
 * once and never replaced. Feeding `useEmblaCarousel` a fresh object (or a
 * reactive `startIndex`, or an inline `watchDrag`) makes it re-init the
 * whole carousel on every render — which turns a tab tap into an instant
 * jump instead of a glide and quietly drops the `on('select', …)`
 * listeners. Anything that needs to vary is read through a ref instead.
 *
 * `GLIDE_DURATION` / `GLIDE_FRICTION` re-arm Embla's momentum after a real
 * drag via `internalEngine()` — Embla's own documented hook for tuning
 * post-drag physics — so the release reads as a slower, floatier glide
 * than its snappy defaults (duration 25, friction 0.68). `watchDrag`
 * vetoes the gesture while an overlay is open or when it starts on a
 * horizontally-scrollable strip / anything `data-no-swipe`. Reduced-motion
 * collapses every glide to an instant snap.
 */

const GLIDE_DURATION = 32;
const GLIDE_FRICTION = 0.8;

function startsOnScrollable(target: EventTarget | null, root: HTMLElement): boolean {
  let n = target as HTMLElement | null;
  while (n && n !== root) {
    if (n.dataset && n.dataset.noSwipe !== undefined) return true;
    const s = getComputedStyle(n);
    if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true;
    n = n.parentElement;
  }
  return false;
}

export function SwipeablePages({
  index, count, renderPage, onIndexChange, disabled = false,
}: {
  index: number;
  count: number;
  renderPage: (i: number, active: boolean) => ReactNode;
  onIndexChange: (i: number) => void;
  disabled?: boolean;
}) {
  // Kept fresh after every render, only ever read from event handlers /
  // effects that fire later — so Embla's options + listeners can stay
  // frozen while behaviour still tracks the latest props.
  const disabledRef = useRef(disabled);
  const reduceRef = useRef(false);
  const onIndexChangeRef = useRef(onIndexChange);
  useEffect(() => {
    disabledRef.current = disabled;
    reduceRef.current = prefersReducedMotion();
    onIndexChangeRef.current = onIndexChange;
  });

  // Built exactly once (lazy initialiser). `startIndex` is the *initial*
  // tab; everything after is driven by scrollTo / drag on the same
  // never-re-inited instance.
  const [emblaOptions] = useState<EmblaOptionsType>(() => ({
    axis: 'x',
    align: 'start',
    startIndex: index,
    duration: GLIDE_DURATION,
    watchDrag: (api, evt) => !disabledRef.current && !startsOnScrollable(evt.target, api.rootNode()),
  }));
  const [viewportRef, emblaApi] = useEmblaCarousel(emblaOptions);

  // Viewport height tracks the *active* slide's own content height (not the
  // tallest of the four permanently-mounted screens), and re-measures as
  // that screen's content changes.
  useEffect(() => {
    if (!emblaApi) return;
    const root = emblaApi.rootNode();
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h != null) root.style.height = `${h}px`;
    });
    const sync = () => {
      ro.disconnect();
      const node = emblaApi.slideNodes()[emblaApi.selectedScrollSnap()];
      if (!node) return;
      root.style.height = `${node.offsetHeight}px`;
      ro.observe(node);
    };
    sync();
    emblaApi.on('select', sync).on('reInit', sync);
    return () => { ro.disconnect(); emblaApi.off('select', sync).off('reInit', sync); };
  }, [emblaApi]);

  // A real drag just ended — re-arm the settle with the slower physics (or
  // an instant snap under reduced-motion) before Embla's own scrollTo
  // kicks the animation off.
  useEffect(() => {
    if (!emblaApi) return;
    const onPointerUp = () => {
      const { scrollBody } = emblaApi.internalEngine();
      if (reduceRef.current) scrollBody.useDuration(0);
      else scrollBody.useDuration(GLIDE_DURATION).useFriction(GLIDE_FRICTION);
    };
    emblaApi.on('pointerUp', onPointerUp);
    return () => { emblaApi.off('pointerUp', onPointerUp); };
  }, [emblaApi]);

  // Tab-bar tap / programmatic tab change → glide there (jump, i.e.
  // instant, under reduced-motion).
  useEffect(() => {
    if (!emblaApi || emblaApi.selectedScrollSnap() === index) return;
    emblaApi.scrollTo(index, reduceRef.current);
  }, [emblaApi, index]);

  // Embla settled on a new slide, from a drag or a tap → tell the store.
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => onIndexChangeRef.current(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);

  return (
    // overflow (both axes): the viewport's explicit height only constrains
    // the page if the three off-screen slides can't overflow past it.
    <div ref={viewportRef} style={{ overflow: 'hidden', touchAction: 'pan-y' }}>
      {/* alignItems: flex-start — a flex row's default `stretch` forces
          every slide to the tallest one's height, which then fed back out
          of the ResizeObserver above and made the height sync a no-op. */}
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} style={{ flex: '0 0 100%', minWidth: 0 }}>
            {renderPage(i, i === index)}
          </div>
        ))}
      </div>
    </div>
  );
}
