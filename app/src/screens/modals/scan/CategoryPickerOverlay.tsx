import { useEffect, useState } from 'react';
import {
  CAT_EMOJI, CATEGORY_GROUP_BG, ESSENTIAL_CATEGORIES, LIFESTYLE_CATEGORIES, MONEY_CATEGORIES, OTHERS_CATEGORIES,
} from '../../../lib/constants';
import { prefersReducedMotion } from '../../../lib/motion';

const SECTIONS: { title: string; categories: string[]; bg: string }[] = [
  { title: 'Essential spending', categories: ESSENTIAL_CATEGORIES, bg: CATEGORY_GROUP_BG.essential },
  { title: 'Lifestyle', categories: LIFESTYLE_CATEGORIES, bg: CATEGORY_GROUP_BG.lifestyle },
  { title: 'Money management', categories: MONEY_CATEGORIES, bg: CATEGORY_GROUP_BG.money },
  { title: 'Others', categories: OTHERS_CATEGORIES, bg: CATEGORY_GROUP_BG.others },
];

/** Full-page category grid, opened from ReviewStep's Category row. Not a
 * scanStep -- purely local UI state on the caller (categoryPickerOpen) so
 * closing it (via a selection or the back chevron) always lands back on
 * the exact in-progress review screen with zero reducer involvement.
 *
 * Always mounted; `open` controls visibility. It used to be a plain
 * `{categoryPickerOpen && <CategoryPickerOverlay/>}` in the caller, which
 * entered with slide-in-right but vanished in a single frame the instant a
 * category was tapped -- no exit animation ran at all, since a conditional
 * unmount gives one no chance to. Mirrors components/BottomSheet.tsx /
 * ScanFlow.tsx's rendered/closing pattern: enter is derived during render,
 * exit is a timeout that unmounts only once the slide-out has actually
 * played (bug report, 2026-09-05: "the animation flashes, too quick"). */
export function CategoryPickerOverlay({ open, value, onSelect, onClose }: {
  open: boolean;
  value: string;
  onSelect: (cat: string) => void;
  onClose: () => void;
}) {
  const [rendered, setRendered] = useState(open);
  if (open && !rendered) setRendered(true);
  const closing = rendered && !open;

  useEffect(() => {
    if (!closing) return;
    const ms = prefersReducedMotion() ? 120 : 300;
    const t = setTimeout(() => setRendered(false), ms);
    return () => clearTimeout(t);
  }, [closing]);

  if (!rendered) return null;

  return (
    <div
      className={`slide-in-right${closing ? ' slide-out-right' : ''}`}
      style={{ position: 'fixed', inset: 0, zIndex: 45, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'auto' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(env(safe-area-inset-top) + 16px) 20px 8px' }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="pressable"
          style={{ background: 'none', border: 'none', padding: 8, marginLeft: -8, cursor: 'pointer', color: 'var(--color-text)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"></path></svg>
        </button>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18 }}>Select category</span>
      </div>

      <div style={{ padding: '8px 20px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <div style={{ font: '700 15px var(--font-heading)', marginBottom: 12 }}>{section.title}</div>
            <div className="card elev-sm" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px 12px' }}>
              {section.categories.map((opt) => {
                const active = value === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { onSelect(opt); onClose(); }}
                    className="pressable"
                    style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, boxSizing: 'border-box' }}
                  >
                    <span style={{
                      width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: section.bg, fontSize: 26, lineHeight: 1, flexShrink: 0, position: 'relative',
                      boxShadow: active ? '0 0 0 3px var(--color-accent)' : 'none',
                    }}>
                      {CAT_EMOJI[opt]}
                      {active && (
                        <span style={{
                          position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: '50%',
                          background: 'var(--color-accent)', border: '2px solid var(--color-bg)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>
                        </span>
                      )}
                    </span>
                    <span style={{ font: '600 12px var(--font-body)', color: 'var(--color-text)', textAlign: 'center' }}>{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
