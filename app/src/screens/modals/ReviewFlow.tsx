import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';
import { selectReviewFlow } from '../../store/selectors';
import { BRAND, paymentMethodOptions } from '../../lib/constants';
import { money, isoToDisplayDate } from '../../lib/format';
import { categoryToReliefKey } from '../../lib/taxEngine';
import type { ReviewItem } from '../../lib/seedData';
import { AmountKeypadSheet } from '../../components/AmountKeypadSheet';
import { CategoryPickerOverlay } from './scan/CategoryPickerOverlay';
import { DateField } from './scan/shared';

function badgeFor(item: ReviewItem) {
  const b = BRAND[item.brand] || { bg: 'var(--color-neutral-400)', letter: (item.name || item.merchant)[0] || '?', fg: '#fff' };
  return { bg: b.bg, fg: b.fg, letter: b.letter };
}

const fieldLabelStyle: CSSProperties = {
  font: '600 10.5px var(--font-body)', letterSpacing: '0.04em', textTransform: 'uppercase',
  color: 'var(--color-text-muted)', marginBottom: 4, display: 'block',
};

export function ReviewFlow() {
  const { state } = useStore();
  const actions = useActions();

  const [fling, setFling] = useState<'left' | 'right' | null>(null);
  const [amountSheetOpen, setAmountSheetOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // Swipe can start ANYWHERE on the card. We wait for a clear horizontal
  // drag before committing to a swipe (and only then capture the pointer),
  // so a tap on a field still focuses it and a vertical drag still scrolls
  // the card — but a sideways drag over any part of it flings the card.
  const drag = useRef<{ x: number; y: number; mode: 'idle' | 'swipe' | 'other' } | null>(null);

  if (!state.reviewOpen) return null;

  const review = selectReviewFlow(state);
  const { curItem, nextItem, dragX, rotate, acceptOpacity, rejectOpacity } = review;

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, mode: 'idle' };
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'idle') {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.4) {
        d.mode = 'swipe';
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        actions.reviewDown(d.x);
        actions.reviewMove(e.clientX);
      } else {
        d.mode = 'other'; // vertical — leave it for scrolling / the field
      }
      return;
    }
    if (d.mode === 'swipe') actions.reviewMove(e.clientX);
  };
  const onUp = () => {
    if (drag.current?.mode === 'swipe') actions.reviewUp();
    drag.current = null;
  };

  const decide = (dir: 'left' | 'right') => {
    if (fling) return;
    setFling(dir);
    window.setTimeout(() => {
      if (dir === 'right') actions.acceptCurrent();
      else actions.rejectCurrent();
      setFling(null);
    }, 240);
  };

  const patch = (p: Partial<ReviewItem>) => { if (curItem) actions.updateReviewItem(curItem.id, p); };

  const curBadge = curItem ? badgeFor(curItem) : null;
  const nextBadge = nextItem ? badgeFor(nextItem) : null;
  const autoCount = state.autoAddedThisImport.length;
  const paymentOpts = curItem ? paymentMethodOptions(state.ob.manual, curItem.payment) : [];
  const isIncome = curItem?.kind === 'income' || (curItem ? curItem.amount > 0 : false);

  return (
    <div
      className="screen-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 45, background: 'var(--color-bg)',
        display: 'flex', flexDirection: 'column', padding: 'calc(env(safe-area-inset-top) + 20px) 20px 24px', boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button
          type="button"
          onClick={actions.closeReview}
          aria-label="Close"
          className="pressable"
          style={{ background: 'none', border: 'none', padding: 8, marginLeft: -8, cursor: 'pointer', color: 'var(--color-text)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17 }}>Review</span>
        <span style={{ font: '600 12px var(--font-body)', color: 'var(--color-text-muted)' }}>{review.reviewCount} left</span>
      </div>

      {autoCount > 0 && !bannerDismissed && (
        <div
          className="pop-in"
          style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 12px',
            borderRadius: 'var(--radius-md)', background: 'var(--color-accent-100)', color: 'var(--color-accent-800)',
            font: '600 12.5px var(--font-body)',
          }}
        >
          <span style={{ flex: 1 }}>
            {autoCount} added automatically from your history
          </span>
          <button
            type="button"
            onClick={actions.undoAutoAdded}
            className="pressable"
            style={{ all: 'unset', cursor: 'pointer', font: '700 12.5px var(--font-body)', color: 'var(--color-accent-800)', textDecoration: 'underline' }}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss"
            className="pressable"
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', color: 'var(--color-accent-800)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      )}

      {curItem && curBadge ? (
        <>
          <div style={{ flex: 1, position: 'relative' }}>
            {nextItem && nextBadge && (
              <div
                className="card"
                style={{
                  position: 'absolute', inset: '8px 14px', transform: 'scale(0.96) translateY(10px)', opacity: 0.6,
                  display: 'flex', flexDirection: 'column', padding: 22,
                }}
              >
                <div
                  style={{
                    width: 38, height: 38, borderRadius: '50%', background: nextBadge.bg, color: nextBadge.fg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, marginBottom: 14,
                  }}
                >
                  {nextBadge.letter}
                </div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{nextItem.name || nextItem.merchant}</div>
              </div>
            )}
            <div
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className="card elev-md"
              style={{
                position: 'absolute', inset: '0 6px', display: 'flex', flexDirection: 'column', padding: 20,
                boxSizing: 'border-box', cursor: 'grab', touchAction: 'pan-y', overflowY: 'auto',
                transform: fling
                  ? `translateX(${fling === 'right' ? 140 : -140}%) rotate(${fling === 'right' ? 22 : -22}deg)`
                  : `translateX(${dragX}px) rotate(${rotate}deg)`,
                opacity: fling ? 0 : 1,
                transition: fling
                  ? 'transform .26s cubic-bezier(.4,0,1,1), opacity .26s ease'
                  : state.reviewDragging ? 'none' : 'transform .25s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div
                  style={{
                    width: 40, height: 40, borderRadius: '50%', background: curBadge.bg, color: curBadge.fg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0,
                  }}
                >
                  {curBadge.letter}
                </div>
                {curItem.learned && (
                  <span
                    className="tag tag-accent"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
                    </svg>
                    From your history
                  </span>
                )}
              </div>

              {/* Amount — tap to open the calculator keypad */}
              <button
                type="button"
                data-no-swipe
                onClick={() => setAmountSheetOpen(true)}
                className="pressable"
                style={{ all: 'unset', cursor: 'pointer', boxSizing: 'border-box', width: '100%' }}
              >
                <div
                  className="type-numeric"
                  style={{
                    fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 30,
                    color: isIncome ? 'var(--color-accent-700)' : 'var(--color-text)',
                  }}
                >
                  {isIncome ? '+' : '−'}RM {money(Math.abs(curItem.amount))}
                </div>
              </button>

              <div style={{ height: 1, background: 'var(--color-neutral-300)', margin: '14px 0' }} />

              {/* Date + Paid with */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }} data-no-swipe>
                  <span style={fieldLabelStyle}>Date</span>
                  <DateField
                    value={curItem.dateIso ?? ''}
                    onChange={(iso) => patch({ dateIso: iso, dateLabel: isoToDisplayDate(iso) })}
                  />
                </div>
                <div style={{ flex: 1 }} data-no-swipe>
                  <span style={fieldLabelStyle}>Paid with</span>
                  <select
                    className="input picker-field"
                    value={curItem.payment}
                    onChange={(e) => patch({ payment: e.target.value })}
                  >
                    {paymentOpts.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Expense name */}
              <div style={{ marginTop: 12 }} data-no-swipe>
                <span style={fieldLabelStyle}>Expense name</span>
                <input
                  className="input"
                  maxLength={40}
                  placeholder="Enter expense name"
                  value={curItem.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </div>

              {/* Merchant / Vendor */}
              <div style={{ marginTop: 10 }} data-no-swipe>
                <span style={fieldLabelStyle}>Merchant</span>
                <input
                  className="input"
                  placeholder="Enter merchant or vendor"
                  value={curItem.merchant}
                  onChange={(e) => patch({ merchant: e.target.value })}
                />
              </div>

              {/* Category */}
              <button
                type="button"
                data-no-swipe
                onClick={() => setCategoryPickerOpen(true)}
                className="pressable"
                style={{
                  all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--color-divider)', boxSizing: 'border-box', width: '100%',
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Category</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ font: '600 13.5px var(--font-body)', color: 'var(--color-text)' }}>{curItem.cat}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                </span>
              </button>

              {/* Tax deductible */}
              <div style={{ marginTop: 14 }} data-no-swipe>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Tax deductible</span>
                  <span style={{ font: '600 11px var(--font-body)', color: 'var(--color-text-muted)' }}>
                    {categoryToReliefKey(curItem.cat) ? 'Category may qualify' : 'No matching relief'}
                  </span>
                </div>
                <div className="seg">
                  <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
                    <input type="radio" name={`revTax-${curItem.id}`} checked={!!curItem.taxDeductible} onChange={() => patch({ taxDeductible: true })} />
                    Yes
                  </label>
                  <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
                    <input type="radio" name={`revTax-${curItem.id}`} checked={!curItem.taxDeductible} onChange={() => patch({ taxDeductible: false })} />
                    No
                  </label>
                </div>
              </div>

              <div style={{ flex: 1 }} />

              <div
                style={{
                  position: 'absolute', top: 20, left: 20, padding: '5px 12px', border: '3px solid var(--color-accent)',
                  color: 'var(--color-accent)', fontWeight: 800, fontSize: 14, letterSpacing: '0.05em', borderRadius: 8,
                  transform: 'rotate(-12deg)', opacity: acceptOpacity, pointerEvents: 'none',
                }}
              >
                ADD
              </div>
              <div
                style={{
                  position: 'absolute', top: 20, right: 20, padding: '5px 12px', border: '3px solid var(--color-danger)',
                  color: 'var(--color-danger)', fontWeight: 800, fontSize: 14, letterSpacing: '0.05em', borderRadius: 8,
                  transform: 'rotate(12deg)', opacity: rejectOpacity, pointerEvents: 'none',
                }}
              >
                SKIP
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 22, padding: '20px 0 6px' }}>
            <button
              type="button"
              onClick={() => decide('left')}
              aria-label="Reject"
              className="pressable"
              style={{
                width: 56, height: 56, borderRadius: '50%', background: 'var(--color-surface)',
                border: '1.5px solid var(--color-danger)', color: 'var(--color-danger)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => decide('right')}
              aria-label="Accept"
              className="pressable"
              style={{
                width: 56, height: 56, borderRadius: '50%', background: 'var(--color-accent)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </button>
          </div>
          <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--color-text-muted)' }}>Swipe right to add, left to skip · tap a field to edit</div>
        </>
      ) : (
        <div className="screen-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div
            className="pop-in"
            style={{
              width: 64, height: 64, borderRadius: '50%', background: 'var(--color-neutral-200)', color: 'var(--color-text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-700)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 19, marginBottom: 6 }}>All caught up</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 26 }}>Nothing left to review right now.</div>
          <button type="button" onClick={actions.closeReview} className="btn btn-primary" style={{ padding: '14px 28px' }}>
            Back to Home
          </button>
        </div>
      )}

      {curItem && (
        <AmountKeypadSheet
          open={amountSheetOpen}
          value={String(Math.abs(curItem.amount) || '')}
          onClose={() => setAmountSheetOpen(false)}
          onSave={(raw) => {
            const n = Math.abs(parseFloat(raw) || 0);
            patch({ amount: isIncome ? n : -n });
          }}
        />
      )}
      {curItem && (
        <CategoryPickerOverlay
          open={categoryPickerOpen}
          value={curItem.cat}
          onSelect={(cat) => patch({ cat, taxDeductible: categoryToReliefKey(cat) != null })}
          onClose={() => setCategoryPickerOpen(false)}
        />
      )}
    </div>
  );
}
