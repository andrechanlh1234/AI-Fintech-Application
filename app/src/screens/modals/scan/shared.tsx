import { todayIso } from '../../../lib/format';

function formatLongDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return 'Select date';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * One date control: shows the date as "Aug 28, 2026" and, on a tap anywhere,
 * opens the device's native date picker. The <input type="date"> fills the
 * whole control transparently so the tap lands on the input itself — a
 * separate visible overlay on a fake field proved flaky on iOS.
 */
export function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  return (
    <label
      className="input"
      style={{ display: 'flex', alignItems: 'center', position: 'relative', cursor: 'pointer' }}
    >
      <span style={{ font: '600 13.5px var(--font-body)', color: value ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
        {formatLongDate(value)}
      </span>
      <input
        type="date"
        value={value}
        max={todayIso()}
        onChange={(e) => { if (e.target.value) onChange(e.target.value); }}
        aria-label="Date"
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          opacity: 0, border: 0, padding: 0, margin: 0, cursor: 'pointer',
        }}
      />
    </label>
  );
}
