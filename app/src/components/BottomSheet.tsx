import type { ReactNode } from 'react';

/** Full-screen overlay sheet — used for scan, review, tax-item detail,
 * add-subscription, donate, tax pack, more/notif panels. `align="center"` is
 * a smaller, fully-rounded dialog centered in the viewport instead of docked
 * to an edge — used for the Net Worth balance/invest detail popups, which
 * are quick in-context edits rather than a full destination screen. Mirrors
 * the dc.html's `position:absolute;inset:0;z-index:50` overlay pattern. */
export function BottomSheet({ open, onClose, children, align = 'bottom' }: { open: boolean; onClose: () => void; children: ReactNode; align?: 'bottom' | 'full' | 'center' }) {
  if (!open) return null;
  const isCenter = align === 'center';
  return (
    <div
      className="screen-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: align === 'bottom' ? 'flex-end' : isCenter ? 'center' : 'stretch',
        justifyContent: 'center', padding: isCenter ? 20 : 0, boxSizing: 'border-box',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="pop-in"
        style={{
          width: '100%', maxWidth: isCenter ? 340 : 480, maxHeight: align === 'bottom' ? '90vh' : isCenter ? '85vh' : '100vh',
          background: 'var(--color-bg)', color: 'var(--color-text)',
          borderRadius: align === 'bottom' ? 'var(--radius-lg) var(--radius-lg) 0 0' : isCenter ? 'var(--radius-lg)' : 0,
          overflow: 'auto', boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
    </div>
  );
}
