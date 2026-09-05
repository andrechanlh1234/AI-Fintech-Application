// One bucket row for the onboarding "Set your monthly budget" step:
// relabelled name + examples on the left, the current amount (tap to open
// the app's calculator keypad for an exact figure) on the right, and a
// full-width drag-to-set slider underneath, RM0-RM50k. Dragging shows a
// big floating number above the thumb -- same idea as the calculator's big
// display -- so the exact amount is always visible while scrubbing, not
// just after you let go. Replaces the old -/+ stepper pair (bug report,
// 2026-09-05: "let's make this an interactive line you can adjust ... it'll
// show a big number ... otherwise they can also click on it and edit").
// Kept in its own file so BudgetSetupStep stays readable.
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { AmountKeypadSheet } from './AmountKeypadSheet';
import { moneyWhole } from '../lib/format';
import { BUDGET_SLIDER_MAX, budgetFractionFromValue, budgetValueFromFraction } from '../lib/budgetSlider';
import { popScale } from '../lib/motion';

const KEY_STEP = 50; // arrow-key nudge, same increment the old +/- buttons used

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
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(amount);
  const trackRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const pop = () => popScale(bubbleRef.current, 3, 30);

  // % of income -- the old row surfaced this as the thin bar's own fill
  // width; the bar is now the RM0-50k slider itself, so this instead
  // becomes a small caption under it (still worth keeping: it's the one
  // thing the absolute RM figure alone doesn't tell you).
  const incomePct = income > 0 ? Math.round((amount / income) * 100) : null;
  const shownAmount = dragging ? dragValue : amount;
  const thumbFraction = budgetFractionFromValue(shownAmount);

  const valueFromClientX = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return amount;
    return budgetValueFromFraction((clientX - rect.left) / rect.width);
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const next = valueFromClientX(e.clientX);
    setDragging(true);
    setDragValue(next);
    pop();
    onChange(next);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const next = valueFromClientX(e.clientX);
    if (next !== dragValue) { setDragValue(next); pop(); onChange(next); }
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const clamp = (n: number) => Math.max(0, Math.min(BUDGET_SLIDER_MAX, Math.round(n)));
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(clamp(amount + KEY_STEP)); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(clamp(amount - KEY_STEP)); }
    else if (e.key === 'Home') { e.preventDefault(); onChange(0); }
    else if (e.key === 'End') { e.preventDefault(); onChange(BUDGET_SLIDER_MAX); }
  };

  return (
    <div className="card" style={{ gap: 10, marginBottom: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>{examples}</div>
        </div>
        <button
          type="button" className="pressable" onClick={() => setKeypadOpen(true)}
          aria-label={`Edit ${name} amount`}
          style={{
            all: 'unset', cursor: 'pointer', boxSizing: 'border-box', textAlign: 'right',
            flexShrink: 0, font: '700 15px var(--font-heading)',
          }}
        >
          <span className="type-numeric">RM {moneyWhole(amount)}</span>
        </button>
      </div>

      {/* Drag-to-set slider, RM0-RM50k. touchAction:'none' keeps a
          horizontal drag here from also being read as the app's own
          swipe-between-tabs gesture or a page scroll (bug report,
          2026-09-05). */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={`${name} monthly budget`}
        aria-valuemin={0}
        aria-valuemax={BUDGET_SLIDER_MAX}
        aria-valuenow={Math.round(amount)}
        aria-valuetext={`RM ${moneyWhole(amount)}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
        style={{ position: 'relative', padding: '10px 0', cursor: 'pointer', touchAction: 'none', outline: 'none' }}
      >
        <div style={{ height: 8, borderRadius: 4, background: 'var(--color-neutral-200)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', width: `${thumbFraction * 100}%`, borderRadius: 4,
              background: 'var(--color-accent)',
              transition: dragging ? 'none' : 'width .18s ease',
            }}
          />
        </div>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', top: '50%', left: `${thumbFraction * 100}%`,
            width: 18, height: 18, borderRadius: '50%', background: 'var(--color-accent)',
            border: '2.5px solid var(--color-surface)', boxShadow: 'var(--shadow-sm)',
            transform: `translate(-50%, -50%) scale(${dragging ? 1.15 : 1})`,
            transition: dragging ? 'transform .12s ease' : 'left .18s ease, transform .12s ease',
            pointerEvents: 'none',
          }}
        />

        {/* Big floating number while dragging -- the anchor% is clamped
            away from the very ends of the track so the centred bubble
            never spills past the card's own edges near RM0 or RM50k. */}
        {dragging && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', bottom: '100%',
              left: `${Math.max(12, Math.min(88, thumbFraction * 100))}%`, marginBottom: 6,
              transform: 'translateX(-50%)',
              background: 'var(--color-text)', color: 'var(--color-bg)',
              borderRadius: 'var(--radius-md)', padding: '6px 12px',
              whiteSpace: 'nowrap', boxShadow: 'var(--shadow-md)',
            }}
          >
            <span ref={bubbleRef} className="type-numeric" style={{ font: '700 17px var(--font-heading)', display: 'inline-block' }}>
              RM {moneyWhole(dragValue)}
            </span>
          </div>
        )}
      </div>

      {incomePct != null && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: -2 }}>
          {incomePct}% of your income
        </div>
      )}

      <AmountKeypadSheet
        open={keypadOpen}
        value={amount > 0 ? String(amount) : ''}
        onClose={() => setKeypadOpen(false)}
        onSave={(raw) => onChange(Math.max(0, Math.round(parseFloat(raw) || 0)))}
      />
    </div>
  );
}
