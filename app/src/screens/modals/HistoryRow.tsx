import { money, isoToDisplayDate } from '../../lib/format';
import type { BalanceEntry } from '../../lib/seedData';

export function HistoryRow({ entry, onRemove }: { entry: BalanceEntry; onRemove: () => void }) {
  const descLabel = entry.desc || (entry.amount >= 0 ? 'Added' : 'Deducted');
  const dateLabel = isoToDisplayDate(entry.date) || entry.date || '—';
  const amountLabel = (entry.amount >= 0 ? '+' : '−') + 'RM ' + money(Math.abs(entry.amount));
  const amountColor = entry.amount >= 0 ? 'var(--color-accent-700)' : 'var(--color-danger-700)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--color-neutral-300)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{descLabel}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{dateLabel}</div>
      </div>
      <div className="type-numeric" style={{ fontSize: 13.5, fontWeight: 700, color: amountColor }}>{amountLabel}</div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="pressable"
        style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--color-text-muted)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );
}
