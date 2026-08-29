import { useState, type AnimationEvent as ReactAnimationEvent, type ReactNode } from 'react';
import { hasPendingSharedOrigin } from '../lib/motion';

/**
 * Pane switch (spec §1, revised). Top-level tabs and the Finance sub-tabs are
 * lateral moves between sibling panes, so — like iOS's own tab switches — the
 * incoming pane does a short directional slide + crossfade and the outgoing
 * one is simply covered (no parallax, no receding full-screen clone: that
 * read as heavier navigation than it is and the DOM clone hitched a frame).
 *
 * `order` picks the slide direction: a higher order enters from the right, a
 * lower one from the left. Direction is derived during render via the "store
 * previous value in state" pattern — no refs touched during render.
 *
 * When a shared-element morph is already captured for the destination
 * (tap a card → its detail), this stands down (`dir: 'none'`) so the morph
 * is the only motion.
 */
export function PageTransition({ pageKey, order, children }: {
  pageKey: string;
  order: number;
  children: ReactNode;
}) {
  const [snap, setSnap] = useState<{ key: string; order: number; dir: 'forward' | 'back' | 'none' }>(
    { key: pageKey, order, dir: 'none' },
  );

  if (pageKey !== snap.key) {
    const dir: 'forward' | 'back' | 'none' = hasPendingSharedOrigin()
      ? 'none'
      : order >= snap.order ? 'forward' : 'back';
    setSnap({ key: pageKey, order, dir });
  }

  const cls =
    snap.dir === 'forward' ? 'page-enter-forward'
      : snap.dir === 'back' ? 'page-enter-back'
        : '';

  // Drop the animation class once the slide finishes so a settled pane
  // carries no leftover `will-change` / `position` / `z-index` — that
  // residue promotes the pane to its own layer and can nudge text by a
  // sub-pixel, which reads as "the layout shifts a little between pages".
  const settle = (e: ReactAnimationEvent) => {
    if (e.target === e.currentTarget) setSnap((s) => (s.dir === 'none' ? s : { ...s, dir: 'none' }));
  };

  return (
    <div key={snap.key} className={cls} style={{ minHeight: '100%' }} onAnimationEnd={settle}>
      {children}
    </div>
  );
}
