import { useState, type CSSProperties } from 'react';
import { useDismissOnOutside } from './PeriodPicker';

/** Apple-style single-select filter dropdown: a "Filter ▾" trigger that
 * opens a floating, frosted (.material-chrome) popover -- same pattern as
 * PeriodPicker's YearPicker, generalized to an arbitrary option list.
 * Not a native <select> and not an always-visible chip row: the trigger
 * stays compact when a filter is applied, and the popover dismisses on an
 * outside tap or Escape. `allLabel` is the "no filter" option (shown first,
 * and what makes the trigger read as inactive again). */
export function FilterPicker({
  value, options, onChange, allLabel = 'All', align = 'left', triggerStyle,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  allLabel?: string;
  /** Which edge the popover hangs from -- 'right' keeps it from running off
   * the viewport when the trigger itself sits at the screen's right edge. */
  align?: 'left' | 'right';
  /** One-off overrides on the trigger button (e.g. to match a sibling
   * field's height / corner radius when placed inline). */
  triggerStyle?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useDismissOnOutside(open, () => setOpen(false));
  const active = value !== allLabel;

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="pressable"
        style={{
          all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '6px 11px', borderRadius: 999, font: '500 11.5px var(--font-body)', whiteSpace: 'nowrap',
          border: '1.5px solid', borderColor: active ? 'var(--color-accent)' : 'var(--color-neutral-400)',
          background: active ? 'var(--color-accent-100)' : 'var(--color-surface)',
          color: active ? 'var(--color-accent-700)' : 'var(--color-text)',
          ...triggerStyle,
        }}
      >
        {active ? value : 'Filter'}
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          className="popover-origin"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', [align]: 0, zIndex: 30, minWidth: 200, maxHeight: 320, overflowY: 'auto',
            borderRadius: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.12)',
            border: '1px solid var(--color-divider)', background: 'var(--color-surface)',
            padding: 6, '--pop-origin': `top ${align}`,
          } as CSSProperties}
        >
          {[allLabel, ...options].map((opt, i, arr) => {
            const selected = opt === value;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className="pressable"
                style={{
                  all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 'var(--radius-sm)',
                  font: '500 14px var(--font-body)', color: selected ? 'var(--color-accent-700)' : 'var(--color-text)',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--color-divider)' : 'none',
                }}
              >
                {opt}
                {selected && (
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-700)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
