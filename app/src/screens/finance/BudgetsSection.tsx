import { useState } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';
import { selectBudgets, selectSubscriptions } from '../../store/selectors';
import { Card } from '../../components/primitives';
import { moneyWhole } from '../../lib/format';
import { BudgetGauge } from './BudgetGauge';
import { BudgetUtilisationBar } from '../../components/BudgetUtilisationBar';
import { AddBudgetCategoryForm } from '../../components/AddBudgetCategoryForm';
import { BUDGET_COMMON_CATEGORIES } from '../../lib/constants';
import { captureSharedOrigin } from '../../lib/motion';

// Ported from Cukai v7.dc.html lines 1297-1404: the gauge, bucket list, and
// subscriptions summary that make up the Budgets screen.
export function BudgetsSection() {
  const { state } = useStore();
  const actions = useActions();
  const { buckets } = selectBudgets(state);
  const { subs, monthlyTotal, yearlyLabel } = selectSubscriptions(state);
  // Which bucket currently has the guided "add category" form open — same
  // AddBudgetCategoryForm the onboarding budget step uses, so this screen's
  // "+ Add category" no longer drops a blank row you rename after the fact.
  const [addingFor, setAddingFor] = useState<string | null>(null);

  return (
    <div>
      <BudgetGauge />
      <div style={{ borderTop: '1px solid var(--color-divider)', marginBottom: 16 }} />
      {buckets.map((b) => (
        <Card key={b.key} style={{ marginBottom: 8, padding: '11px 13px' }}>
          <button
            type="button"
            onClick={() => actions.toggleBucket(b.key)}
            className="pressable"
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5, width: '100%', boxSizing: 'border-box' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13 }}>{b.name}</span>
              <svg
                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)"
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: b.expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .2s ease' }}
              >
                <path d="m9 18 6-6-6-6"></path>
              </svg>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div className="type-numeric" style={{ fontWeight: 700, fontSize: 14 }}>
                RM {b.spentLabel}{' '}
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)' }}>/ RM {b.totalLabel}</span>
              </div>
              <div className="type-numeric" style={{ fontSize: 13.5, fontWeight: 800, color: b.pct > 100 ? 'var(--color-danger-700)' : 'var(--color-accent-700)', flexShrink: 0 }}>
                {b.pct}%
              </div>
            </div>
            <BudgetUtilisationBar pct={b.pct} barPct={b.barPct} />
          </button>

          {b.expanded && (
            <div className="pop-in" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--color-neutral-300)' }}>
              {b.categories.map((c) => (
                <div key={c.id}>
                  <button
                    type="button"
                    onClick={(e) => { captureSharedOrigin(e.currentTarget); actions.openBudgetItemDetail(c.detailKey); }}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <BudgetUtilisationBar pct={c.pct} barPct={c.barPct} />
                      </div>
                      <div className="type-numeric" style={{ fontSize: 13, fontWeight: 800, color: c.pct > 100 ? 'var(--color-danger-700)' : 'var(--color-accent-700)', flexShrink: 0 }}>
                        {c.pct}%
                      </div>
                    </div>
                  </button>
                  {c.note && (
                    <div style={{ fontSize: 10.5, color: c.noteColor, marginTop: 4 }}>{c.note}</div>
                  )}
                </div>
              ))}
              {addingFor === b.key ? (
                <AddBudgetCategoryForm
                  bucketKey={b.key}
                  commonNames={BUDGET_COMMON_CATEGORIES[b.key] ?? []}
                  existingNames={b.categories.map((c) => c.name)}
                  onDone={() => setAddingFor(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingFor(b.key)}
                  className="pressable"
                  style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-accent-700)', font: '700 12px var(--font-body)', padding: '4px 0' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14"></path>
                    <path d="M12 5v14"></path>
                  </svg>
                  Add category
                </button>
              )}
            </div>
          )}
        </Card>
      ))}

      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 19, margin: '20px 0 10px' }}>Subscriptions</div>
      <div style={{ display: 'flex', gap: 26, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Monthly</div>
          <div className="type-numeric" style={{ fontWeight: 700, fontSize: 16 }}>RM {moneyWhole(monthlyTotal)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Yearly</div>
          <div className="type-numeric" style={{ fontWeight: 700, fontSize: 16 }}>RM {yearlyLabel}</div>
        </div>
      </div>
      <Card style={{ padding: '4px 14px', marginBottom: 12 }}>
        {subs.map((s, i) => (
          <div key={s.name + i} className="sub-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--color-neutral-300)' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, background: 'var(--color-neutral-200)', color: 'var(--color-text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: 14,
            }}>
              {s.name[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                {s.kind === 'plan'
                  ? `${Number(s.paidInstallments) || 0} of ${Number(s.totalInstallments) || 0} paid · ${s.provider || s.category}`
                  : `${s.frequency} · ${s.category}`}
              </div>
            </div>
            <div className="type-numeric" style={{ fontWeight: 600, fontSize: 13.5, flexShrink: 0 }}>RM {moneyWhole(parseFloat(s.amount) || 0)}</div>
          </div>
        ))}
        {subs.length === 0 && (
          <div style={{ padding: '16px 0', fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>No subscriptions yet.</div>
        )}
      </Card>
      <button
        type="button"
        onClick={actions.openAddSub}
        className="pressable"
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-accent-700)', font: '700 12.5px var(--font-body)', padding: '6px 0', marginBottom: 20 }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14"></path>
          <path d="M12 5v14"></path>
        </svg>
        Add subscription
      </button>
    </div>
  );
}
