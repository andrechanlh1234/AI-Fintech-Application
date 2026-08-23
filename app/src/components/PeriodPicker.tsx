import { useState, type CSSProperties } from 'react';
import { MONTH_ORDER } from '../lib/constants';

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

  const stepMonth = (dir: 1 | -1) => {
    const idx = MONTH_ORDER.indexOf(month);
    let nextIdx = idx + dir;
    let nextYear = year;
    if (nextIdx < 0) { nextIdx = 11; nextYear -= 1; }
    if (nextIdx > 11) { nextIdx = 0; nextYear += 1; }
    onChange(MONTH_ORDER[nextIdx], nextYear);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <button type="button" onClick={() => stepMonth(-1)} aria-label="Previous month" className="pressable" style={chevBtnStyle}>
          <ChevronLeft />
        </button>
        <button
          type="button"
          onClick={() => { setViewYear(year); setOpen((o) => !o); }}
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
        <div className="pop-in card" style={{ marginTop: 14, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 14 }}>
            <button type="button" onClick={() => setViewYear((y) => y - 1)} aria-label="Previous year" className="pressable" style={chevBtnStyle}>
              <ChevronLeft size={16} />
            </button>
            <span className="type-numeric" style={{ font: '800 17px var(--font-heading)', letterSpacing: '-0.01em' }}>{viewYear}</span>
            <button type="button" onClick={() => setViewYear((y) => y + 1)} aria-label="Next year" className="pressable" style={chevBtnStyle}>
              <ChevronRight size={16} />
            </button>
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

/** Apple-style year picker: a horizontally-scrollable pill strip, no fixed
 * "2026/2025" toggle -- `years` is computed by the caller so future years
 * appear as they roll around without redesigning the component. */
/** Apple-style year dropdown: a compact "2026 v" trigger that expands a
 * grid of years in place, closing on selection -- not a permanently laid
 * out row of pills. Same tap-to-reveal card language as MonthPicker. */
export function YearPicker({ year, years, onChange }: { year: number; years: number[]; onChange: (year: number) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="pressable type-numeric"
        style={{
          all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', borderRadius: 999, font: '700 15px var(--font-heading)',
          background: 'var(--color-neutral-200)', color: 'var(--color-text)',
        }}
      >
        {year}
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="pop-in card" style={{ marginTop: 10, padding: 12, width: 220 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            {years.map((y) => {
              const selected = y === year;
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => { onChange(y); setOpen(false); }}
                  className="pressable type-numeric"
                  style={{
                    all: 'unset', cursor: 'pointer', textAlign: 'center', padding: '9px 0', borderRadius: 'var(--radius-md)', font: '700 14px var(--font-body)',
                    background: selected ? 'var(--color-accent)' : 'transparent', color: selected ? '#fff' : 'var(--color-text)',
                  }}
                >
                  {y}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
