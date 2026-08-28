import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { hasPendingSharedOrigin, playPageExit, prefersReducedMotion } from '../lib/motion';

/**
 * Fluid Push (spec §1). When `pageKey` changes the incoming screen mounts
 * fresh (keyed remount) and slides in from the leading edge with a slight
 * scale-up; `order` decides direction — a higher order drills forward
 * (enters from the right), a lower one is a back-nav (enters from the left).
 *
 * Direction is derived during render via the "store previous value in state"
 * pattern (no refs touched during render), so it survives the immediate
 * re-render that the derivation triggers.
 *
 * The outgoing screen isn't kept mounted as a React ghost — several screens
 * run their own effects (AI chat, camera, sync) and a throwaway second mount
 * would double-fire them. Instead, after each page settles we snapshot its
 * DOM (`innerHTML` + rect); on the next navigation `playPageExit` clones
 * that snapshot behind the incoming screen and animates it receding (spec
 * §1's "previous page scales to ~98% and fades"). The snapshot is taken on
 * arrival, so a page with lots of transient local state (a half-typed
 * search) recedes as it looked when opened — an acceptable trade for not
 * re-serializing the DOM on every unrelated state change.
 */
export function PageTransition({ pageKey, order, children }: {
  pageKey: string;
  order: number;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef<{ html: string; rect: DOMRect } | null>(null);
  const [snap, setSnap] = useState<{ key: string; order: number; dir: 'forward' | 'back' | 'none' }>(
    { key: pageKey, order, dir: 'none' },
  );

  if (pageKey !== snap.key) {
    // A shared-element morph into this screen should be the only motion —
    // no push slide, no receding ghost (dir 'none' suppresses both).
    const dir: 'forward' | 'back' | 'none' = hasPendingSharedOrigin()
      ? 'none'
      : order >= snap.order ? 'forward' : 'back';
    setSnap({ key: pageKey, order, dir });
  }

  // Recede the page we just left, using the snapshot captured when it
  // settled (below). Runs before paint so the ghost and the incoming
  // slide-in start on the same frame. `snap.dir` (set in the same update as
  // `snap.key`) carries the direction, so no ref is written during render.
  useLayoutEffect(() => {
    if ((snap.dir === 'forward' || snap.dir === 'back') && snapshotRef.current && !prefersReducedMotion()) {
      playPageExit(snapshotRef.current.html, snapshotRef.current.rect, snap.dir);
    }
  }, [snap.key, snap.dir]);

  // Snapshot the now-current page for the next navigation.
  useLayoutEffect(() => {
    if (wrapRef.current) {
      snapshotRef.current = {
        html: wrapRef.current.innerHTML,
        rect: wrapRef.current.getBoundingClientRect(),
      };
    }
  }, [snap.key]);

  const cls =
    snap.dir === 'forward' ? 'page-enter-forward'
      : snap.dir === 'back' ? 'page-enter-back'
        : '';

  return (
    <div key={snap.key} ref={wrapRef} className={cls} style={{ minHeight: '100%' }}>
      {children}
    </div>
  );
}
