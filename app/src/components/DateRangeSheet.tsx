import { BottomSheet } from './BottomSheet';
import { todayIso, daysAgoIso } from '../lib/format';

const PRESETS: { label: string; from: string; to: string }[] = [
  { label: 'Today', from: todayIso(), to: todayIso() },
  { label: 'Yesterday', from: daysAgoIso(1), to: daysAgoIso(1) },
  { label: 'Last 7 days', from: daysAgoIso(6), to: todayIso() },
  { label: 'Last 30 days', from: daysAgoIso(29), to: todayIso() },
  { label: 'Last 90 days', from: daysAgoIso(89), to: todayIso() },
  { label: 'Last 1 year', from: daysAgoIso(364), to: todayIso() },
];

/** Bottom sheet for picking the transaction list's date range on "All
 * transactions" -- quick presets apply immediately and close the sheet;
 * the custom from/to range (native date inputs) applies live and leaves
 * the sheet open, since setting a range means touching two fields. Dates
 * flow as ISO strings throughout. See
 * docs/superpowers/specs/2026-08-24-record-date-range-filter-design.md. */
export function DateRangeSheet({
  open, from, to, defaultFrom, defaultTo, onChange, onClose,
}: {
  open: boolean;
  from: string;
  to: string;
  defaultFrom: string;
  defaultTo: string;
  onChange: (from: string, to: string) => void;
  onClose: () => void;
}) {
  const reset = () => { onChange(defaultFrom, defaultTo); onClose(); };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ padding: '20px 20px 28px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17 }}>Filter by date</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              type="button"
              onClick={reset}
              className="pressable"
              style={{ all: 'unset', cursor: 'pointer', color: 'var(--color-accent-700)', font: '700 13px var(--font-body)' }}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="pressable"
              style={{ all: 'unset', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 18 }}>
          {PRESETS.map((p) => {
            const selected = from === p.from && to === p.to;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => { onChange(p.from, p.to); onClose(); }}
                className="pressable"
                style={{
                  all: 'unset', cursor: 'pointer', textAlign: 'center', padding: '10px 6px', borderRadius: 'var(--radius-md)',
                  font: '700 12.5px var(--font-body)',
                  background: selected ? 'var(--color-accent-100)' : 'var(--color-neutral-200)',
                  color: selected ? 'var(--color-accent-700)' : 'var(--color-text)',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div style={{ borderTop: '1px solid var(--color-divider)', marginBottom: 16 }} />

        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Custom date range</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => { if (e.target.value) onChange(e.target.value > to ? to : e.target.value, to); }}
            style={{
              flex: 1, minWidth: 0, border: 'none', borderRadius: 999, padding: '10px 12px',
              background: 'var(--color-accent-100)', color: 'var(--color-accent-700)', font: '700 13px var(--font-body)',
            }}
          />
          <span style={{ color: 'var(--color-text-muted)' }}>–</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => { if (e.target.value) onChange(from, e.target.value < from ? from : e.target.value); }}
            style={{
              flex: 1, minWidth: 0, border: 'none', borderRadius: 999, padding: '10px 12px',
              background: 'var(--color-accent-100)', color: 'var(--color-accent-700)', font: '700 13px var(--font-body)',
            }}
          />
        </div>
      </div>
    </BottomSheet>
  );
}
