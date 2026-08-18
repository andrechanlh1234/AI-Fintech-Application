import type { ReactNode } from 'react';

/** Full-screen overlay sheet — used for scan, review, balance/invest/tax-item
 * detail, add-subscription, donate, tax pack, more/notif panels. Mirrors the
 * dc.html's `position:absolute;inset:0;z-index:50` overlay pattern. */
export function BottomSheet({ open, onClose, children, align = 'bottom' }: { open: boolean; onClose: () => void; children: ReactNode; align?: 'bottom' | 'full' }) {
  if (!open) return null;
  return (
    <div
      className="screen-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: align === 'bottom' ? 'flex-end' : 'stretch',
        justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="pop-in"
        style={{
          width: '100%', maxWidth: 480, maxHeight: align === 'bottom' ? '90vh' : '100vh',
          background: 'var(--color-bg)', color: 'var(--color-text)',
          borderRadius: align === 'bottom' ? 'var(--radius-lg) var(--radius-lg) 0 0' : 0,
          overflow: 'auto', boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
    </div>
  );
}
