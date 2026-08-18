import { useStore, useActions } from '../../store/StoreProvider';
import { selectBudgets } from '../../store/selectors';
import { Card } from '../../components/primitives';

// Ported from Cukai v7.dc.html lines 1297-1404 (budgets bucket list only —
// the donut gauge and subscriptions list at the top/bottom of that range are
// owned by other screen components). Data comes from selectBudgets(state).
export function BudgetsSection() {
  const { state } = useStore();
  const actions = useActions();
  const { buckets } = selectBudgets(state);

  return (
    <div>
      {buckets.map((b) => (
        <Card key={b.key} style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => actions.toggleBucket(b.key)}
            className="pressable"
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, width: '100%', boxSizing: 'border-box' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15 }}>{b.name}</span>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)"
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: b.expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .2s ease' }}
              >
                <path d="m9 18 6-6-6-6"></path>
              </svg>
            </div>
            <div className="type-numeric" style={{ fontWeight: 700, fontSize: 17 }}>
              RM {b.spentLabel}{' '}
              <span style={{ fontSize: 12.5, fontWeight: 400, color: 'var(--color-text-muted)' }}>/ RM {b.totalLabel}</span>
            </div>
            <div style={{ height: 7, background: 'var(--color-neutral-300)', borderRadius: 4, overflow: 'hidden' }}>
              <div className="bar-fill" style={{ height: '100%', width: `${b.pct}%`, background: 'var(--color-accent)', borderRadius: 4 }} />
            </div>
          </button>

          {b.expanded && (
            <div className="pop-in" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--color-neutral-300)' }}>
              {b.categories.map((c) => (
                <div key={c.id}>
                  <button
                    type="button"
                    onClick={() => actions.openBudgetItemDetail(c.detailKey)}
                    className="pressable"
                    style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', boxSizing: 'border-box' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, marginBottom: 5 }}>
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="type-numeric">RM {c.spentLabel} / RM {c.totalLabel}</span>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="m9 18 6-6-6-6"></path>
                        </svg>
                      </span>
                    </div>
                    <div style={{ height: 5, background: 'var(--color-neutral-300)', borderRadius: 3, overflow: 'hidden' }}>
                      <div className="bar-fill" style={{ height: '100%', width: `${c.pct}%`, background: c.barColor, borderRadius: 3 }} />
                    </div>
                  </button>
                  {c.note && (
                    <div style={{ fontSize: 10.5, color: c.noteColor, marginTop: 4 }}>{c.note}</div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => actions.addBucketCategory(b.key)}
                className="pressable"
                style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-accent-700)', font: '700 12px var(--font-body)', padding: '4px 0' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"></path>
                  <path d="M12 5v14"></path>
                </svg>
                Add category
              </button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
