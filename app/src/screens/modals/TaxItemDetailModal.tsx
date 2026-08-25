import { useStore, useActions } from '../../store/StoreProvider';
import { selectTaxCenter } from '../../store/selectors';
import { moneyWhole, money } from '../../lib/format';

// Ported from Cukai v7.dc.html lines 737-763 (taxItemDetailOpen modal).
// state.taxItemDetailOpen ("groupKey:itemKey") is the open/closed flag;
// selectTaxCenter(state).taxItemDetail resolves it to the live item + group name.

function statusStyle(status: string): { bg: string; color: string } {
  if (status === 'Available') return { bg: 'var(--color-neutral-200)', color: 'var(--color-text-muted)' };
  return { bg: 'var(--color-neutral-300)', color: 'var(--color-text-muted)' };
}

export function TaxItemDetailModal() {
  const { state } = useStore();
  const actions = useActions();
  if (!state.taxItemDetailOpen) return null;

  const tax = selectTaxCenter(state);
  const detail = tax.taxItemDetail;
  if (!detail) return null;
  const { item, groupName } = detail;
  const style = statusStyle(item.status);

  return (
    <div
      className="screen-in"
      style={{
        position: 'absolute', inset: 0, zIndex: 47, background: 'var(--color-bg)',
        display: 'flex', flexDirection: 'column', padding: 'calc(env(safe-area-inset-top) + 16px) 20px 24px', boxSizing: 'border-box', overflow: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17 }}>{item.label}</span>
        <button
          type="button"
          onClick={actions.closeTaxItemDetail}
          aria-label="Close"
          className="pressable"
          style={{ background: 'none', border: 'none', padding: 8, marginRight: -8, cursor: 'pointer', color: 'var(--color-text)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginBottom: 14 }}>{groupName}</div>
      <span className="tag" style={{ background: style.bg, color: style.color, alignSelf: 'flex-start', marginBottom: 10 }}>{item.status}</span>
      <div className="type-numeric" style={{ fontWeight: 700, fontSize: 22, marginBottom: 8 }}>
        RM {moneyWhole(item.captured)} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--color-text-muted)' }}>/ RM {moneyWhole(item.cap)} cap</span>
      </div>
      <div style={{ height: 8, background: 'var(--color-neutral-300)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
        <div className="bar-fill" style={{ height: '100%', width: `${item.pct}%`, background: 'var(--color-accent)', borderRadius: 4 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--color-text-muted)', marginBottom: 20, gap: 8 }}>
        <span>RM {moneyWhole(item.remaining)} remaining</span>
        {item.remaining > 0 && (
          <span style={{ color: 'var(--color-accent-700)', fontWeight: 600 }}>~RM {moneyWhole(item.potentialBenefit)} potential benefit</span>
        )}
      </div>
      <div style={{ font: '600 11px var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>
        Receipts
      </div>
      <div className="card" style={{ padding: '4px 14px' }}>
        {item.receipts.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--color-neutral-300)' }}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: r.isOther ? 400 : 600, color: r.isOther ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
              {r.merchant}
            </div>
            <div className="type-numeric" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>RM {money(r.amount)}</div>
          </div>
        ))}
        {item.receipts.length === 0 && (
          <div style={{ padding: '16px 0', fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            No receipts logged yet — scan one to start capturing this relief.
          </div>
        )}
      </div>
    </div>
  );
}
