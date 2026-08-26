import { iconFlags } from '../../../lib/constants';
import { TxIcon } from '../../../components/TransactionRow';
import { RECEIPT_CATEGORY_OPTIONS } from './shared';

/** Full-page category grid, opened from ReviewStep's Category row. Not a
 * scanStep -- purely local UI state on the caller (categoryPickerOpen) so
 * closing it (via a selection or the back chevron) always lands back on
 * the exact in-progress review screen with zero reducer involvement. */
export function CategoryPickerOverlay({ value, onSelect, onClose }: {
  value: string;
  onSelect: (cat: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="screen-in" style={{ position: 'absolute', inset: 0, zIndex: 45, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px 8px' }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="pressable"
          style={{ background: 'none', border: 'none', padding: 8, marginLeft: -8, cursor: 'pointer', color: 'var(--color-text)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"></path></svg>
        </button>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18 }}>Select category</span>
      </div>
      <div style={{ padding: '12px 20px 32px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px 12px' }}>
        {RECEIPT_CATEGORY_OPTIONS.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => { onSelect(opt); onClose(); }}
              className="pressable"
              style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, boxSizing: 'border-box' }}
            >
              <span style={{
                width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: active ? 'var(--color-accent)' : 'var(--color-neutral-200)',
                color: active ? '#fff' : 'var(--color-text-muted)', position: 'relative', flexShrink: 0,
                boxShadow: active ? '0 0 0 3px var(--color-accent-100)' : 'none',
              }}>
                <TxIcon tx={{ ...iconFlags(opt), hasBrand: false, badgeLetter: '' }} />
              </span>
              <span style={{ font: '600 12px var(--font-body)', color: 'var(--color-text)', textAlign: 'center' }}>{opt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
