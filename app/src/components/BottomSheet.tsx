import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { prefersReducedMotion } from '../lib/motion';

/** Ref-counted so several stacked sheets don't fight over the shell class. */
let openSheetCount = 0;
function pushShellRecede() {
  openSheetCount += 1;
  if (openSheetCount === 1) {
    const root = document.getElementById('root');
    root?.firstElementChild?.classList.add('app-scaled-back');
  }
}
function popShellRecede() {
  openSheetCount = Math.max(0, openSheetCount - 1);
  if (openSheetCount === 0) {
    const root = document.getElementById('root');
    root?.firstElementChild?.classList.remove('app-scaled-back');
  }
}

/** Full-screen overlay sheet — used for scan, review, balance/invest/history
 * detail, tax-item detail, add-subscription, donate, tax pack, more/notif
 * panels.
 *
 * Motion (spec §3 bottom sheets / §4 modals):
 *  - align="bottom": rises from the bottom with a soft spring, settles with
 *    no heavy bounce; the shell behind scales down ~2% + dims/blurs.
 *  - align="full": "Spring Pop" — 95% + slightly transparent -> 100% with a
 *    hair of overshoot.
 * Dismissal reverses. Honours prefers-reduced-motion (short fade).
 *
 * Portals to document.body so an ancestor transform can't trap it, and so
 * it inherits the live `:root` `data-theme` — the sheet surface reads
 * `var(--color-*)` off :root every frame, never a value captured at open
 * time, so a theme switch while the sheet is open recolours it live (L7).
 */
export function BottomSheet({ open, onClose, children, align = 'bottom', recede = true }: {
  open: boolean; onClose: () => void; children: ReactNode; align?: 'bottom' | 'full';
  /** Scale + dim the app shell behind the sheet (default). Pass false when
   * the sheet opens over a full-bleed surface that shouldn't move — e.g.
   * the scan camera's "more ways to add expense". */
  recede?: boolean;
}) {
  // `rendered` lingers past `open` going false so the exit animation can
  // play. Enter is derived during render (no setState in an effect); exit is
  // a timeout whose setState fires in the timer callback, not synchronously.
  const [rendered, setRendered] = useState(open);
  if (open && !rendered) setRendered(true);
  const closing = rendered && !open;

  useEffect(() => {
    if (!closing) return;
    const ms = prefersReducedMotion() ? 120 : 380;
    const t = setTimeout(() => setRendered(false), ms);
    return () => clearTimeout(t);
  }, [closing]);

  useEffect(() => {
    if (!rendered || !recede) return;
    pushShellRecede();
    return () => popShellRecede();
  }, [rendered, recede]);

  if (!rendered) return null;

  const isFull = align === 'full';
  return createPortal(
    <div
      className={`sheet-scrim${closing ? ' is-closing' : ''}`}
      style={{ display: 'flex', alignItems: isFull ? 'stretch' : 'flex-end', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`sheet-panel${closing ? ' is-closing' : ''}${isFull ? ' spring-pop' : ''}`}
        style={{
          width: '100%', maxWidth: 480, maxHeight: isFull ? '100dvh' : '90dvh',
          background: 'var(--color-bg)', color: 'var(--color-text)',
          borderRadius: isFull ? 0 : 'var(--radius-lg) var(--radius-lg) 0 0',
          overflowY: 'auto', WebkitOverflowScrolling: 'touch', boxSizing: 'border-box',
          overscrollBehavior: 'contain',
          // Keep the last row / action button clear of the home indicator.
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
