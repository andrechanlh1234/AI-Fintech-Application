import type { CSSProperties, ReactNode } from 'react';
import { todayIso } from '../../../lib/format';

function formatLongDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return 'Select date';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Shared by both fields below so an <input type="date"> and a <select>
// -- two different native controls with their own platform-specific
// rendering quirks (iOS Safari in particular keeps some of a bare
// <select>'s own line-height/vertical-centering even with
// `appearance: none`) -- always come out as two pixel-identical boxes
// rather than two independent attempts at matching `.input`. Both render
// the real control fully transparent and absolutely positioned over a
// plain `.field`-style label + span; only that span is ever actually
// seen, so the two can never drift apart again (bug report, 2026-09-05:
// Date and Payment method, side by side, weren't quite aligned).
const HIDDEN_CONTROL_STYLE: CSSProperties = {
  position: 'absolute', inset: 0, width: '100%', height: '100%',
  opacity: 0, border: 0, padding: 0, margin: 0, cursor: 'pointer', fontSize: 16,
};

/**
 * `margin: 0` inline is deliberate: this is a <label> nested inside `.field`,
 * so it would otherwise inherit `.field label`'s header spacing/size and
 * sit lower than its sibling.
 */
function PickerField({ display, muted, children }: { display: string; muted?: boolean; children: ReactNode }) {
  return (
    <label className="input picker-field" style={{ position: 'relative', cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center' }}>
      <span style={{ fontSize: 13, fontWeight: 400, whiteSpace: 'nowrap', color: muted ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
        {display}
      </span>
      {children}
    </label>
  );
}

/** One date control. Shows the date as "Aug 28, 2026"; a tap anywhere
 * forwards (native <label> behaviour) to a full-size transparent
 * <input type="date">, which opens the device's own date picker. */
export function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  return (
    <PickerField display={formatLongDate(value)} muted={!value}>
      <input
        type="date"
        value={value}
        max={todayIso()}
        onChange={(e) => { if (e.target.value) onChange(e.target.value); }}
        aria-label="Date"
        style={HIDDEN_CONTROL_STYLE}
      />
    </PickerField>
  );
}

/** One dropdown control (e.g. payment method) -- same box as DateField
 * above, a transparent native <select> layered on top for the actual
 * interaction/native picker UI. */
export function SelectField({ value, options, onChange, ariaLabel }: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  return (
    <PickerField display={value}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        style={HIDDEN_CONTROL_STYLE}
      >
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </PickerField>
  );
}
