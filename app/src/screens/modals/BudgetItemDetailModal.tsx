import { useStore, useActions } from '../../store/StoreProvider';
import { moneyWhole } from '../../lib/format';

// Ported from Cukai v7.dc.html lines 713-736 (budgetItemDetailOpen modal).
// state.budgetItemDetailOpen is "bucketKey:categoryId" — look up the live
// category object from state.finance.buckets so edits reflect immediately.
export function BudgetItemDetailModal() {
  const { state } = useStore();
  const actions = useActions();
  const open = state.budgetItemDetailOpen;
  if (!open) return null;

  const [bucketKey, catId] = open.split(':');
  const bucket = state.finance.buckets.find((b) => b.key === bucketKey);
  const category = bucket?.categories.find((c) => c.id === catId);
  if (!bucket || !category) return null;

  const spent = category.items.reduce((s, it) => s + (parseFloat(String(it.amount)) || 0), 0);

  return (
    <div
      className="screen-in"
      style={{
        position: 'absolute', inset: 0, zIndex: 47, background: 'var(--color-bg)',
        display: 'flex', flexDirection: 'column', padding: 'calc(env(safe-area-inset-top) + 16px) 20px 24px', boxSizing: 'border-box', overflow: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17 }}>{category.name}</span>
        <button
          type="button"
          onClick={actions.closeBudgetItemDetail}
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

      <div className="type-numeric" style={{ fontWeight: 700, fontSize: 20, marginBottom: 14 }}>
        RM {moneyWhole(spent)}{' '}
        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--color-text-muted)' }}>/ RM {moneyWhole(category.cap)} budget</span>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Category name</label>
          <input
            className="input"
            value={category.name}
            onChange={(e) => actions.setBucketCategoryName(bucketKey, catId, e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Monthly budget (RM)</label>
          <input
            className="input"
            value={String(category.cap)}
            onChange={(e) => actions.setBucketCategoryCap(bucketKey, catId, parseFloat(e.target.value) || 0)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div style={{ font: '600 11px var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>
        Line items
      </div>

      {category.items.map((it) => (
        <div key={it.id} className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, padding: '10px 12px' }}>
          <input
            className="input"
            value={it.name}
            onChange={(e) => actions.setBucketItemField(bucketKey, catId, it.id, 'name', e.target.value)}
            placeholder="Item name"
            style={{ flex: 1.3 }}
          />
          <input
            className="input"
            value={String(it.amount)}
            onChange={(e) => actions.setBucketItemField(bucketKey, catId, it.id, 'amount', e.target.value)}
            placeholder="Amount (RM)"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => actions.removeBucketItem(bucketKey, catId, it.id)}
            aria-label="Remove"
            className="pressable"
            style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--color-text-muted)', flexShrink: 0 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => actions.addBucketItem(bucketKey, catId)}
        className="pressable"
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-accent-700)', font: '700 12.5px var(--font-body)', padding: '6px 0', marginBottom: 20 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14"></path>
          <path d="M12 5v14"></path>
        </svg>
        Add line item
      </button>

      <button
        type="button"
        onClick={() => actions.removeBucketCategory(bucketKey, catId)}
        className="pressable"
        style={{ all: 'unset', cursor: 'pointer', display: 'block', textAlign: 'center', color: 'var(--color-danger-700)', font: '700 12px var(--font-body)', padding: '6px 0' }}
      >
        Delete this category
      </button>
    </div>
  );
}
