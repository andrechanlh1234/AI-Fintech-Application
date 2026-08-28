import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { MONTH_ORDER } from '../lib/constants';

/** Closes an open popover on any pointerdown outside its root, and on
 * Escape -- the standard dismiss behavior for a floating menu (as opposed
 * to an inline expand/collapse card, which stays open until tapped again). */
export function useDismissOnOutside(open: boolean, onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onDismiss]);
  return ref;
}

const chevBtnStyle: CSSProperties = {
  all: 'unset', cursor: 'pointer', padding: 8, borderRadius: 999, color: 'var(--color-text-muted)', display: 'flex',
};

function ChevronLeft({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
function ChevronRight({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** Shared floating year list -- the popover half of YearPicker, reusable
 * anywhere a year needs picking from a short list. Used standalone by
 * YearPicker and embedded inside MonthPicker's grid, so month and year
 * selection share one interaction language app-wide. */
function YearMenu({
  year, years, onChange, align = 'right',
}: { year: number; years: number[]; onChange: (year: number) => void; align?: 'left' | 'right' | 'center' }) {
  const posStyle: CSSProperties =
    align === 'right' ? { right: 0 } : align === 'left' ? { left: 0 } : { left: '50%', transform: 'translateX(-50%)' };
  return (
    <div
      className="material-chrome popover-origin"
      style={{
        position: 'absolute', top: 'calc(100% + 8px)', zIndex: 30, minWidth: 168,
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-divider)',
        overflow: 'hidden', padding: 6, '--pop-origin': `top ${align === 'center' ? 'center' : align}`, ...posStyle,
      } as CSSProperties}
    >
      {years.map((y, i) => {
        const selected = y === year;
        return (
          <button
            key={y}
            type="button"
            onClick={() => onChange(y)}
            className="pressable type-numeric"
            style={{
              all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 'var(--radius-sm)',
              font: '500 15px var(--font-body)', color: selected ? 'var(--color-accent-700)' : 'var(--color-text)',
              borderBottom: i < years.length - 1 ? '1px solid var(--color-divider)' : 'none',
            }}
          >
            {y}
            {selected && (
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-700)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Apple-style month picker: a tappable "Month Year" pill with step chevrons
 * on either side, expanding into a 4x3 month grid for the tapped year. Shared
 * across Record (primary filter) and Stats (12-month view). */
export function MonthPicker({
  month, year, onChange, hasDataInMonth,
}: {
  month: string;
  year: number;
  onChange: (month: string, year: number) => void;
  hasDataInMonth?: (month: string, year: number) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(year);
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const rootRef = useDismissOnOutside(open, () => { setOpen(false); setYearMenuOpen(false); });

  const stepMonth = (dir: 1 | -1) => {
    const idx = MONTH_ORDER.indexOf(month);
    let nextIdx = idx + dir;
    let nextYear = year;
    if (nextIdx < 0) { nextIdx = 11; nextYear -= 1; }
    if (nextIdx > 11) { nextIdx = 0; nextYear += 1; }
    onChange(MONTH_ORDER[nextIdx], nextYear);
  };

  const yearOptions = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 4 + i);

  return (
    <div ref={rootRef}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <button type="button" onClick={() => stepMonth(-1)} aria-label="Previous month" className="pressable" style={chevBtnStyle}>
          <ChevronLeft />
        </button>
        <button
          type="button"
          onClick={() => { setViewYear(year); setOpen((o) => !o); setYearMenuOpen(false); }}
          className="pressable"
          style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, font: '700 17px var(--font-heading)' }}
        >
          {month} {year}
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <button type="button" onClick={() => stepMonth(1)} aria-label="Next month" className="pressable" style={chevBtnStyle}>
          <ChevronRight />
        </button>
      </div>
      {open && (
        <div className="popover-origin card" style={{ marginTop: 14, padding: 16, '--pop-origin': 'top center' } as CSSProperties}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, position: 'relative' }}>
            <button
              type="button"
              onClick={() => setYearMenuOpen((o) => !o)}
              className="pressable type-numeric"
              style={{
                all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 999, font: '800 17px var(--font-heading)', letterSpacing: '-0.01em',
                background: 'var(--color-neutral-200)', color: 'var(--color-text)',
              }}
            >
              {viewYear}
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ transform: yearMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {yearMenuOpen && (
              <YearMenu
                year={viewYear}
                years={yearOptions}
                onChange={(y) => { setViewYear(y); setYearMenuOpen(false); }}
                align="center"
              />
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            {MONTH_ORDER.map((m) => {
              const selected = m === month && viewYear === year;
              const has = !selected && hasDataInMonth?.(m, viewYear);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => { onChange(m, viewYear); setOpen(false); }}
                  className="pressable"
                  style={{
                    all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    padding: '12px 0 10px', borderRadius: 'var(--radius-md)',
                    background: selected ? 'var(--color-accent)' : 'transparent', color: selected ? '#fff' : 'var(--color-text)',
                  }}
                >
                  <span style={{ font: '700 14px var(--font-heading)' }}>{m}</span>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: has ? 'var(--color-accent)' : 'transparent' }} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Apple-style year dropdown: a compact "2026 v" trigger that opens a
 * floating popover menu -- a frosted (.material-chrome), rounded, shadowed
 * list that overlays the page and dismisses on an outside tap, the way an
 * iOS pull-down menu behaves. Not an inline card that pushes layout, and
 * not a native <select>. `years` is computed by the caller so future years
 * appear as they roll around without redesigning the component. */
export function YearPicker({ year, years, onChange }: { year: number; years: number[]; onChange: (year: number) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useDismissOnOutside(open, () => setOpen(false));

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="pressable type-numeric"
        style={{
          all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', borderRadius: 999, font: '500 15px var(--font-heading)',
          background: 'var(--color-neutral-200)', color: 'var(--color-text)',
        }}
      >
        {year}
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && <YearMenu year={year} years={years} onChange={(y) => { onChange(y); setOpen(false); }} />}
    </div>
  );
}
