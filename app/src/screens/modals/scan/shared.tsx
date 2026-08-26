import { useState, type CSSProperties } from 'react';
import { paymentMethodOptions, subBadge } from '../../../lib/constants';
import { todayIso } from '../../../lib/format';
import type { ManualData } from '../../../store/types';

export function chipStyle(active: boolean): CSSProperties {
  return {
    all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 12px', borderRadius: 999, font: '600 12px var(--font-body)',
    border: '1.5px solid', borderColor: active ? 'var(--color-accent)' : 'var(--color-neutral-400)',
    background: active ? 'var(--color-accent)' : 'var(--color-surface)',
    color: active ? '#fff' : 'var(--color-text-muted)', boxSizing: 'border-box',
  };
}

// "Today" covers the overwhelming majority of entries with zero taps (it's
// selected the instant the screen opens). "Pick a date" is a real
// <input type="date"> wrapped in a <label> styled to look like the other
// chips -- clicking anywhere in the pill (icon included) activates the
// input via native label->control forwarding, which is what actually opens
// the device's own date UI (a transparent overlay sitting *on top* of a
// separate fake chip was tried first and proved unreliable on iOS Safari;
// this is the input itself, just dressed up -- the date field still trusts
// the platform's own picker, unlike the amount field (see
// AmountKeypadSheet), which needs real arithmetic a native keyboard can't do.
export function DateChips({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const today = todayIso();
  const isToday = value === today;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <button type="button" onClick={() => onChange(today)} className="pressable" style={chipStyle(isToday)}>
        Today
      </button>
      <label className="pressable" style={{ ...chipStyle(!isToday), cursor: 'pointer' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <input
          type="date"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          style={{ all: 'unset', font: '600 12px var(--font-body)', color: 'inherit' }}
        />
      </label>
    </div>
  );
}

function PaymentBadge({ opt }: { opt: string }) {
  const badge = subBadge(opt);
  return (
    <span style={{ width: 16, height: 16, borderRadius: '50%', background: badge.bg, color: badge.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 8.5px var(--font-body)', flexShrink: 0 }}>
      {badge.letter}
    </span>
  );
}

// Two chips max, not the whole paymentMethodOptions() list -- the current
// selection (always visible, never buried) plus the next-most-likely
// option, then a single "+" as the third slot. "+" first reveals the rest
// of the real, already-linked/generic options as more chips (so a bank
// account from onboarding stays one tap away, not something you have to
// retype), and only below that offers a text field for something that
// truly isn't in the list yet -- picking or typing anything immediately
// makes it a chip on this and future receipts either way, since
// paymentMethodOptions() always includes the current value.
export function PaymentChips({ manual, value, onChange }: { manual: ManualData; value: string; onChange: (v: string) => void }) {
  const options = paymentMethodOptions(manual, value);
  const primary = [value, ...options.filter((o) => o !== value)].slice(0, 2);
  const rest = options.filter((o) => !primary.includes(o));
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) onChange(trimmed);
    setAdding(false);
    setDraft('');
  };
  const chip = (opt: string) => (
    <button key={opt} type="button" onClick={() => onChange(opt)} className="pressable" style={chipStyle(value === opt)}>
      <PaymentBadge opt={opt} />
      {opt}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {primary.map(chip)}
      {!expanded && rest.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Show more payment methods"
          className="pressable"
          style={{ ...chipStyle(false), width: 32, height: 32, padding: 0, justifyContent: 'center' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
        </button>
      )}
      {expanded && rest.map(chip)}
      {(expanded || rest.length === 0) && (
        adding ? (
          <input
            autoFocus
            className="input"
            style={{ width: 150, padding: '7px 10px', font: '600 12px var(--font-body)' }}
            placeholder="Payment method name"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label="Add payment method"
            className="pressable"
            style={{ ...chipStyle(false), width: 32, height: 32, padding: 0, justifyContent: 'center' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
          </button>
        )
      )}
    </div>
  );
}
