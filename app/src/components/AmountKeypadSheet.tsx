import { useEffect, useState, type CSSProperties } from 'react';
import { BottomSheet } from './BottomSheet';
import { formatWithCommas, sanitizeRaw } from '../lib/format';

type Op = '+' | '−' | '×' | '÷';

function applyOp(a: number, b: number, op: Op): number {
  if (op === '+') return a + b;
  if (op === '−') return a - b;
  if (op === '×') return a * b;
  return b === 0 ? a : a / b; // divide-by-zero: leave the running total as-is rather than crash to Infinity/NaN
}

// Avoids classic float noise (0.1 + 0.2 !== 0.3) landing in a money amount.
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const OPS: Op[] = ['+', '−', '×', '÷'];
const DIGIT_ROWS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']];

/** A real calculator, not a native decimal keyboard: tapping the amount in
 * ReviewStep opens this bottom sheet instead of focusing an <input>, so
 * "120 + 45.50" can be typed and evaluated in place before it's saved —
 * matching how a receipt total is often actually arrived at (adding up a
 * few line items by hand) rather than requiring the user to pre-compute it
 * themselves on a separate device. */
export function AmountKeypadSheet({ open, value, onClose, onSave }: {
  open: boolean;
  value: string;
  onClose: () => void;
  onSave: (raw: string) => void;
}) {
  const [entry, setEntry] = useState('0');
  const [accumulator, setAccumulator] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<Op | null>(null);
  // True right after an operator or "=" -- the display still shows the
  // previous operand/result (real calculators don't blank it), but the
  // *next* digit press must start a fresh number instead of appending onto
  // that leftover value (e.g. "12" + then "5" must become "5", not "125").
  const [freshEntry, setFreshEntry] = useState(false);

  // Reseed from whatever's already saved every time the sheet opens (not
  // on every keystroke elsewhere) -- a fresh calculator each time, but
  // starting from the current amount so re-opening to nudge it doesn't
  // throw away what's already there.
  useEffect(() => {
    if (!open) return;
    setEntry(value && parseFloat(value) > 0 ? value : '0');
    setAccumulator(null);
    setPendingOp(null);
    setFreshEntry(false);
  }, [open, value]);

  const pressDigit = (d: string) => {
    if (freshEntry) { setEntry(d === '.' ? '0.' : d); setFreshEntry(false); return; }
    if (d === '.' && entry.includes('.')) return;
    if (entry === '0' && d !== '.') { setEntry(d); return; }
    const next = entry + d;
    const dot = next.indexOf('.');
    if (dot !== -1 && next.length - dot - 1 > 2) return; // cap at 2dp, money-safe
    setEntry(next);
  };

  const pressBackspace = () => {
    if (freshEntry) { setEntry('0'); setFreshEntry(false); return; }
    setEntry((e) => (e.length <= 1 ? '0' : e.slice(0, -1)));
  };

  const pressOp = (op: Op) => {
    const current = parseFloat(entry) || 0;
    if (pendingOp != null && accumulator != null && !freshEntry) {
      // Chained operator ("12 + 5 +") -- evaluate the pending op first and
      // show the running total, same as a real calculator's implicit "=".
      const result = round2(applyOp(accumulator, current, pendingOp));
      setAccumulator(result);
      setEntry(String(result));
    } else {
      setAccumulator(current);
    }
    setPendingOp(op);
    setFreshEntry(true);
  };

  const pressEquals = () => {
    if (pendingOp == null || accumulator == null) return;
    const result = round2(applyOp(accumulator, parseFloat(entry) || 0, pendingOp));
    setEntry(String(result));
    setAccumulator(null);
    setPendingOp(null);
    setFreshEntry(true);
  };

  const handleSave = () => {
    // Tapping Save mid-expression (e.g. "120+45.5" with no "=" yet) commits
    // the evaluated result, same as a real calculator's implicit "=".
    const final = pendingOp != null && accumulator != null
      ? String(round2(applyOp(accumulator, parseFloat(entry) || 0, pendingOp)))
      : entry;
    onSave(sanitizeRaw(final));
    onClose();
  };

  const keyStyle: CSSProperties = {
    all: 'unset', cursor: 'pointer', textAlign: 'center', padding: '14px 0',
    font: '600 26px var(--font-heading)', color: 'var(--color-text)', boxSizing: 'border-box',
  };
  const opKeyStyle = (active: boolean): CSSProperties => ({
    all: 'unset', cursor: 'pointer', textAlign: 'center', padding: '10px 0',
    font: '600 20px var(--font-heading)', boxSizing: 'border-box',
    color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
  });

  // Live-calculating display: once an operator is pressed the previous
  // operand + operator shrink into a grey prefix on the same line, and as
  // soon as a digit of the second operand is typed, the big bold number
  // switches from echoing raw input to showing the running result -- e.g.
  // typing "32" "+" "2" "5" reads "32 + 25 =" (small, grey) "57" (bold),
  // recalculating on every keystroke so "=" is a confirmation, not a
  // requirement.
  const hasOp = pendingOp != null && accumulator != null;
  const typingSecondOperand = hasOp && !freshEntry;
  const liveResult = typingSecondOperand ? round2(applyOp(accumulator!, parseFloat(entry) || 0, pendingOp!)) : null;
  const bigDisplayText = typingSecondOperand
    ? formatWithCommas(String(liveResult))
    : (entry === '0' ? '0.00' : formatWithCommas(entry));
  const greyPrefix = hasOp
    ? `${formatWithCommas(String(accumulator))} ${pendingOp}` + (typingSecondOperand ? ` ${formatWithCommas(entry)} =` : '')
    : null;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ padding: '10px 8px 0' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-neutral-300)', margin: '4px auto 4px' }} />
      </div>
      <div style={{ padding: '18px 24px 28px', textAlign: 'center' }}>
        <div style={{ font: '600 13px var(--font-body)', color: 'var(--color-text-muted)', marginBottom: 24 }}>Enter amount</div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
          {greyPrefix && (
            <span className="type-numeric" style={{ font: '600 20px var(--font-heading)', color: 'var(--color-text-muted)' }}>{greyPrefix}</span>
          )}
          <span style={{ font: '700 20px var(--font-heading)', color: 'var(--color-text-muted)' }}>RM</span>
          <span className="type-numeric" style={{ font: '700 44px var(--font-heading)' }}>{bigDisplayText}</span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--color-divider)', padding: '18px 24px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 6 }}>
          {OPS.map((op) => (
            <button key={op} type="button" onClick={() => pressOp(op)} className="pressable" style={opKeyStyle(pendingOp === op)}>{op}</button>
          ))}
          <button type="button" onClick={pressEquals} className="pressable" style={opKeyStyle(false)}>=</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {DIGIT_ROWS.flat().map((d) => (
            <button key={d} type="button" onClick={() => pressDigit(d)} className="pressable" style={keyStyle}>{d}</button>
          ))}
          <button type="button" onClick={() => pressDigit('.')} className="pressable" style={{ ...keyStyle, font: '600 22px var(--font-heading)', color: 'var(--color-text-muted)' }}>.</button>
          <button type="button" onClick={() => pressDigit('0')} className="pressable" style={keyStyle}>0</button>
          <button type="button" onClick={pressBackspace} aria-label="Delete" className="pressable" style={{ ...keyStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* A plain rounded arrow reads friendlier here than a boxed
                "delete key" glyph with a hard-edged X inside it. */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6H9l-6 6 6 6h11a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Z" />
            </svg>
          </button>
        </div>
      </div>

      <div style={{ padding: '18px 20px 28px' }}>
        <button type="button" onClick={handleSave} className="btn btn-primary btn-lg">Save</button>
      </div>
    </BottomSheet>
  );
}
