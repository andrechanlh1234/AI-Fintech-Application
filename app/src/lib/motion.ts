// Premium motion system for Cukai — a tiny hand-rolled toolkit built on CSS
// transitions/keyframes + the Web Animations API. No animation library.
//
// Design intent (from the product spec): calm, fluid, physical, minimal.
// Spring-based easing over linear; most transitions 250–450ms; animate
// transform/opacity only; always honour prefers-reduced-motion.

/** Live check — re-reads the media query each call so a mid-session change
 *  in the OS setting is respected without a reload. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** A CSS cubic-bezier that reads as a gentle, well-damped spring — a small
 *  overshoot then settle, never a bounce. Matches the app's existing
 *  `cubic-bezier(.16,1,.3,1)` decelerate feel but with a touch of life. */
export const SPRING_SOFT = 'cubic-bezier(.22,1,.28,1)';
/** Slightly livelier — for small, fast, tactile pops (key press, check). */
export const SPRING_POP = 'cubic-bezier(.34,1.4,.5,1)';
/** Pure decelerate, no overshoot — for page pushes and large surfaces. */
export const EASE_DECEL = 'cubic-bezier(.16,1,.3,1)';

/** Standard durations (ms). */
export const DUR = {
  micro: 180,   // key pop, toggle
  pop: 300,     // modal spring-pop, popover
  sheet: 400,   // bottom sheet rise
  page: 380,    // page push
  number: 420,  // financial number morph
  chart: 760,   // chart draw
  success: 460, // success check
} as const;

type Animatable = HTMLElement | SVGElement | null | undefined;

/**
 * Fire-and-forget WAAPI animation that no-ops (or snaps to the last frame)
 * under reduced-motion. Returns the Animation so callers can await `.finished`
 * or cancel it.
 */
export function animate(
  el: Animatable,
  keyframes: Keyframe[],
  options: number | KeyframeAnimationOptions,
): Animation | null {
  if (!el || typeof el.animate !== 'function') return null;
  const opts: KeyframeAnimationOptions = typeof options === 'number' ? { duration: options } : { ...options };
  if (prefersReducedMotion()) {
    // Collapse to a short opacity-only fade when the frames touch opacity,
    // otherwise skip entirely (jump straight to the resting state).
    const touchesOpacity = keyframes.some((k) => 'opacity' in k);
    if (!touchesOpacity) return null;
    return el.animate(
      keyframes.map((k) => ({ opacity: k.opacity })),
      { duration: 120, easing: 'ease', fill: opts.fill },
    );
  }
  return el.animate(keyframes, { easing: SPRING_SOFT, ...opts });
}

/**
 * iOS-calculator style key pop: the affected display element scales up by a
 * few px worth of size then springs back. Subtle, fast, spring.
 * `magnitude` ~= extra pixels of apparent size at the peak.
 */
export function popScale(el: Animatable, magnitude = 3, basePx = 38): Animation | null {
  if (!el) return null;
  const peak = 1 + magnitude / basePx;
  return animate(
    el,
    [
      { transform: 'scale(1)' },
      { transform: `scale(${peak.toFixed(4)})`, offset: 0.35 },
      { transform: 'scale(1)' },
    ],
    { duration: DUR.micro, easing: SPRING_POP },
  );
}

/**
 * Fluid Push companion (spec §1): keep a static visual copy of the
 * *outgoing* screen for the length of the push and animate it receding —
 * forward nav pushes it back (scale to ~0.965 + fade), back nav slides it
 * off to the right. It's a plain DOM clone appended behind the incoming
 * screen (z-index 0 vs the incoming page's 1), so the outgoing screen's own
 * effects (camera, sync, AI chat) never re-fire. Caller captures the
 * outgoing DOM's `innerHTML` + rect synchronously (before the swap) and
 * hands them here from a layout effect.
 */
export function playPageExit(html: string, rect: DOMRect | null, dir: 'forward' | 'back'): void {
  if (!html || !rect || !rect.width || prefersReducedMotion()) return;
  const ghost = document.createElement('div');
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, {
    position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, margin: '0',
    width: `${rect.width}px`, height: `${Math.min(rect.height, window.innerHeight)}px`,
    overflow: 'hidden', pointerEvents: 'none', zIndex: '0',
    background: 'var(--color-bg)', willChange: 'transform, opacity',
    transformOrigin: dir === 'forward' ? 'center center' : 'left center',
  } as Partial<CSSStyleDeclaration> as CSSStyleDeclaration);
  ghost.innerHTML = html;
  document.body.appendChild(ghost);

  const to = dir === 'forward'
    ? { transform: 'translateX(-6%) scale(0.965)', opacity: 0.35 }
    : { transform: 'translateX(64%)', opacity: 0.4 };
  const anim = ghost.animate(
    [{ transform: 'translateX(0) scale(1)', opacity: 1 }, to],
    { duration: DUR.page, easing: EASE_DECEL, fill: 'forwards' },
  );
  const cleanup = () => ghost.remove();
  anim.addEventListener('finish', cleanup);
  anim.addEventListener('cancel', cleanup);
  window.setTimeout(cleanup, DUR.page + 150);
}

/**
 * FLIP: given a set of elements keyed by id, capture their rects, run
 * `mutate()` (which reorders/inserts DOM), then animate each surviving
 * element from its old box to its new one via transform only. New elements
 * (no prior rect) fade+rise in.
 */
export function flip(
  getEls: () => Map<string, HTMLElement>,
  mutate: () => void,
  opts: { duration?: number; enterFrom?: Keyframe } = {},
): void {
  const duration = opts.duration ?? DUR.page;
  if (prefersReducedMotion()) { mutate(); return; }
  const before = new Map<string, DOMRect>();
  getEls().forEach((el, id) => before.set(id, el.getBoundingClientRect()));
  mutate();
  requestAnimationFrame(() => {
    getEls().forEach((el, id) => {
      const prev = before.get(id);
      const next = el.getBoundingClientRect();
      if (!prev) {
        el.animate(
          [opts.enterFrom ?? { opacity: 0, transform: 'translateY(8px) scale(0.98)' }, { opacity: 1, transform: 'none' }],
          { duration, easing: SPRING_SOFT },
        );
        return;
      }
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { duration, easing: SPRING_SOFT },
      );
    });
  });
}

/**
 * Shared-element morph via a measured clone. Captures the tapped source
 * element's rect, then on the next frame measures the destination element
 * and flies a lightweight clone of the source from A to B while the real
 * destination fades up underneath. Keeps to transform/opacity.
 *
 * Call `captureSharedOrigin(el)` in the tap handler (before navigation),
 * then `playSharedMorph(destEl)` from the destination's mount effect.
 */
let sharedOrigin: { rect: DOMRect; html: string; bg: string } | null = null;

export function captureSharedOrigin(el: Animatable): void {
  if (!el || prefersReducedMotion()) { sharedOrigin = null; return; }
  const rect = el.getBoundingClientRect();
  const cs = getComputedStyle(el as Element);
  sharedOrigin = { rect, html: (el as HTMLElement).outerHTML, bg: cs.backgroundColor };
  // Auto-expire so a stale capture never morphs an unrelated later screen.
  window.setTimeout(() => { sharedOrigin = null; }, 400);
}

/** True while a shared-element capture is waiting to be consumed — lets the
 *  page-push transition stand down so the morph is the only motion. */
export function hasPendingSharedOrigin(): boolean {
  return sharedOrigin != null;
}

export function playSharedMorph(destEl: Animatable): void {
  const origin = sharedOrigin;
  sharedOrigin = null;
  if (!origin || !destEl || prefersReducedMotion()) return;
  const dest = destEl.getBoundingClientRect();
  if (!dest.width || !dest.height) return;

  const ghost = document.createElement('div');
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, {
    position: 'fixed', left: '0', top: '0', margin: '0',
    width: `${origin.rect.width}px`, height: `${origin.rect.height}px`,
    transform: `translate(${origin.rect.left}px, ${origin.rect.top}px)`,
    transformOrigin: 'top left', zIndex: '9999', pointerEvents: 'none',
    borderRadius: getComputedStyle(destEl as Element).borderRadius || '16px',
    background: origin.bg, overflow: 'hidden', willChange: 'transform, opacity',
    boxShadow: 'var(--shadow-lg)',
  } as CSSStyleDeclaration);
  ghost.innerHTML = origin.html;
  document.body.appendChild(ghost);

  const sx = dest.width / origin.rect.width;
  const sy = dest.height / origin.rect.height;
  const anim = ghost.animate(
    [
      { transform: `translate(${origin.rect.left}px, ${origin.rect.top}px) scale(1, 1)`, opacity: 1 },
      { transform: `translate(${dest.left}px, ${dest.top}px) scale(${sx}, ${sy})`, opacity: 0 },
    ],
    { duration: DUR.page, easing: EASE_DECEL, fill: 'forwards' },
  );
  const cleanup = () => ghost.remove();
  anim.addEventListener('finish', cleanup);
  anim.addEventListener('cancel', cleanup);
  window.setTimeout(cleanup, DUR.page + 120);

  // Destination fades/scales up to meet the ghost.
  animate(
    destEl,
    [{ opacity: 0, transform: 'scale(0.97)' }, { opacity: 1, transform: 'none' }],
    { duration: DUR.pop, easing: SPRING_SOFT },
  );
}
