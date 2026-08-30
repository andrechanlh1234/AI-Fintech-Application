import { todayIso } from '../../../lib/format';

function formatLongDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return 'Select date';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * One date control, styled to be the exact same box as the payment-method
 * <select> beside it. Shows the date as "Aug 28, 2026"; a tap anywhere
 * forwards (native <label> behaviour) to a full-size transparent
 * <input type="date">, which opens the device's own date picker.
 *
 * `margin: 0` inline is deliberate: this is a <label> nested inside `.field`,
 * so it would otherwise inherit `.field label`'s header spacing/size and
 * sit lower than the <select>.
 */
export function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  return (
    <label className="input picker-field" style={{ position: 'relative', cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center' }}>
      <span
        style={{
          fontSize: 12, fontWeight: 400, whiteSpace: 'nowrap',
          color: value ? 'var(--color-text)' : 'var(--color-text-muted)',
        }}
      >
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
          opacity: 0, border: 0, padding: 0, margin: 0, cursor: 'pointer', fontSize: 16,
        }}
      />
    </label>
  );
}
