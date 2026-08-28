import { useState, type ReactNode } from 'react';

/**
 * Fluid Push (spec §1). When `pageKey` changes the incoming screen mounts
 * fresh (keyed remount) and slides in from the leading edge with a slight
 * scale-up; `order` decides direction — a higher order drills forward
 * (enters from the right), a lower one is a back-nav (enters from the left).
 *
 * The direction is derived during render via the "store previous value in
 * state" pattern (no refs, no setState in an effect), so it survives the
 * immediate re-render that the derivation triggers.
 *
 * The outgoing screen is not kept mounted as a ghost — several of these
 * screens run their own effects (AI chat, camera, sync) and a throwaway
 * second mount would double-fire them. The opaque incoming screen sliding
 * over the top reads as the old one receding.
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
    setSnap({ key: pageKey, order, dir: order >= snap.order ? 'forward' : 'back' });
  }

  const cls =
    snap.dir === 'forward' ? 'page-enter-forward'
      : snap.dir === 'back' ? 'page-enter-back'
        : '';

  return (
    <div key={snap.key} className={cls} style={{ minHeight: '100%' }}>
      {children}
    </div>
  );
}
