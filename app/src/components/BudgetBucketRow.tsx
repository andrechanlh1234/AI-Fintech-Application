// One bucket row for the onboarding "Set your monthly budget" step:
// relabelled name + examples on the left, a tappable amount flanked by −/+
// steppers on the right, and a thin proportion bar (amount ÷ income)
// underneath. Tapping the amount opens the app's calculator keypad sheet.
// Kept in its own file so BudgetSetupStep stays readable.
import { useState, type CSSProperties } from 'react';
import { AmountKeypadSheet } from './AmountKeypadSheet';
import { moneyWhole } from '../lib/format';

const STEP = 50;

export function BudgetBucketRow({
  name, examples, amount, income, onChange,
}: {
  name: string;
  examples: string;
  amount: number;
  income: number;
  onChange: (next: number) => void;
}) {
  const [keypadOpen, setKeypadOpen] = useState(false);
  const clamp = (n: number) => Math.max(0, Math.round(n));
  const pct = income > 0 ? Math.max(0, Math.min(1, amount / income)) : 0;

  return (
    <div className="card" style={{ gap: 10, marginBottom: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>{examples}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            type="button" aria-label={`Decrease ${name}`} className="pressable"
            onClick={() => onChange(clamp(amount - STEP))}
            style={stepBtn}
          >
            −
          </button>
          <button
            type="button" className="pressable" onClick={() => setKeypadOpen(true)}
            style={{
              all: 'unset', cursor: 'pointer', boxSizing: 'border-box', textAlign: 'center',
              minWidth: 92, padding: '7px 8px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-divider)', background: 'var(--color-surface)',
              font: '600 13px var(--font-body)',
            }}
          >
            <span className="type-numeric">RM {moneyWhole(amount)}</span>
          </button>
          <button
            type="button" aria-label={`Increase ${name}`} className="pressable"
            onClick={() => onChange(clamp(amount + STEP))}
            style={stepBtn}
          >
            +
          </button>
        </div>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--color-neutral-200)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, background: 'var(--color-accent)', borderRadius: 2, transition: 'width .18s ease' }} />
      </div>

      <AmountKeypadSheet
        open={keypadOpen}
        value={amount > 0 ? String(amount) : ''}
        onClose={() => setKeypadOpen(false)}
        onSave={(raw) => onChange(clamp(parseFloat(raw) || 0))}
      />
    </div>
  );
}

const stepBtn: CSSProperties = {
  all: 'unset', cursor: 'pointer', boxSizing: 'border-box',
  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--color-neutral-400)', background: 'var(--color-surface)',
  font: '600 17px var(--font-body)', color: 'var(--color-text)',
};
