import type { PointerEvent as ReactPointerEvent } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';
import { selectReviewFlow } from '../../store/selectors';
import { BRAND } from '../../lib/constants';
import { money } from '../../lib/format';
import type { ReviewItem } from '../../lib/seedData';

function badgeFor(item: ReviewItem) {
  const b = BRAND[item.brand] || { bg: 'var(--color-neutral-400)', letter: item.merchant[0] || '?', fg: '#fff' };
  return { bg: b.bg, fg: b.fg, letter: b.letter };
}

export function ReviewFlow() {
  const { state } = useStore();
  const actions = useActions();

  if (!state.reviewOpen) return null;

  const review = selectReviewFlow(state);
  const { curItem, nextItem, dragX, rotate, acceptOpacity, rejectOpacity } = review;

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    actions.reviewDown(e.clientX);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => actions.reviewMove(e.clientX);
  const onUp = () => actions.reviewUp();

  const curBadge = curItem ? badgeFor(curItem) : null;
  const nextBadge = nextItem ? badgeFor(nextItem) : null;

  return (
    <div
      className="screen-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 45, background: 'var(--color-bg)',
        display: 'flex', flexDirection: 'column', padding: 'calc(env(safe-area-inset-top) + 20px) 20px 24px', boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
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
                <div style={{ fontWeight: 700, fontSize: 17 }}>{nextItem.merchant}</div>
              </div>
            )}
            <div
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className="card elev-md"
              style={{
                position: 'absolute', inset: '0 6px', display: 'flex', flexDirection: 'column', padding: 26,
                boxSizing: 'border-box', cursor: 'grab', touchAction: 'pan-y',
                transform: `translateX(${dragX}px) rotate(${rotate}deg)`,
                transition: state.reviewDragging ? 'none' : 'transform .25s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div
                  style={{
                    width: 44, height: 44, borderRadius: '50%', background: curBadge.bg, color: curBadge.fg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 17,
                  }}
                >
                  {curBadge.letter}
                </div>
                <span className="tag tag-neutral">{curItem.cat}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 19, marginBottom: 4 }}>{curItem.merchant}</div>
              <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 20 }}>{curItem.dateLabel}</div>
              <div
                className="type-numeric"
                style={{
                  fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 30, marginBottom: 'auto',
                  color: curItem.amount >= 0 ? 'var(--color-accent-700)' : 'inherit',
                }}
              >
                {curItem.amount >= 0 ? '+' : '−'}RM {money(Math.abs(curItem.amount))}
              </div>
              <div style={{ height: 1, background: 'var(--color-neutral-300)', margin: '14px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                <span>Suggested category</span>
                <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{curItem.cat}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                <span>Paid with</span>
                <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{curItem.payment}</span>
              </div>
              <div
                style={{
                  position: 'absolute', top: 24, left: 24, padding: '5px 12px', border: '3px solid var(--color-accent)',
                  color: 'var(--color-accent)', fontWeight: 800, fontSize: 14, letterSpacing: '0.05em', borderRadius: 8,
                  transform: 'rotate(-12deg)', opacity: acceptOpacity,
                }}
              >
                ADD
              </div>
              <div
                style={{
                  position: 'absolute', top: 24, right: 24, padding: '5px 12px', border: '3px solid var(--color-danger)',
                  color: 'var(--color-danger)', fontWeight: 800, fontSize: 14, letterSpacing: '0.05em', borderRadius: 8,
                  transform: 'rotate(12deg)', opacity: rejectOpacity,
                }}
              >
                SKIP
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 22, padding: '20px 0 6px' }}>
            <button
              type="button"
              onClick={actions.rejectCurrent}
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
              onClick={actions.acceptCurrent}
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
          <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--color-text-muted)' }}>Swipe right to add, left to skip</div>
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
    </div>
  );
}
