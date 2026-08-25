import { useEffect, useRef, useState } from 'react';

export function formatWithCommas(raw: string): string {
  if (!raw) return '';
  const [intPart, ...rest] = raw.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return rest.length ? withCommas + '.' + rest.join('') : withCommas;
}

// Digits and at most one dot, decimals capped to 2 places -- what actually
// gets dispatched to state (parseFloat-safe, no commas), separate from the
// comma-formatted string shown in the input.
export function sanitizeRaw(input: string): string {
  let s = input.replace(/[^\d.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  const [intPart, decPart] = s.split('.');
  return decPart !== undefined ? intPart + '.' + decPart.slice(0, 2) : s;
}

/** A receipt/transaction amount, styled as the single most prominent thing
 * on the screen instead of a plain form field -- but still a real
 * `<input inputMode="decimal">` under the hood, so tapping it brings up
 * the device's own number keyboard rather than a custom on-screen one.
 * Comma-formats live as you type; the value handed to `onChange` is
 * always a clean, comma-free numeric string safe for parseFloat(). */
export function HeroAmountInput({
  value, onChange, autoFocus,
}: { value: string; onChange: (raw: string) => void; autoFocus?: boolean }) {
  const [display, setDisplay] = useState(() => formatWithCommas(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Resync when the underlying value changes from outside this input
    // (an OCR-read amount landing in the draft, "Scan another" resetting
    // it) -- but never while the user has it focused, so we don't fight
    // their own typing/cursor.
    if (document.activeElement !== inputRef.current) setDisplay(formatWithCommas(value));
  }, [value]);

  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
      <span style={{ font: '700 20px var(--font-heading)', color: 'var(--color-text-muted)' }}>RM</span>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        value={display}
        placeholder="0.00"
        aria-label="Total amount"
        onChange={(e) => {
          const raw = sanitizeRaw(e.target.value);
          onChange(raw);
          setDisplay(formatWithCommas(raw));
        }}
        style={{
          all: 'unset', font: '700 44px var(--font-heading)', fontVariantNumeric: 'tabular-nums',
          color: 'var(--color-text)', textAlign: 'center', width: '100%', minWidth: 0, maxWidth: 260,
        }}
      />
    </div>
  );
}
