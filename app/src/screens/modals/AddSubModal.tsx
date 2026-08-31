import { useState } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';
import {
  SUB_FREQUENCY_OPTIONS, SUB_CATEGORY_OPTIONS, paymentMethodOptions,
  INSTALLMENT_PROVIDER_OPTS, INSTALLMENT_TENURE_OPTS,
} from '../../lib/constants';
import { formatWithCommas, isoToDisplayDate, planPayoffDate, planRemainingBalance } from '../../lib/format';
import { AmountKeypadSheet } from '../../components/AmountKeypadSheet';

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

const stepBtnStyle = {
  width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--color-neutral-400)',
  background: 'var(--color-surface)', color: 'var(--color-text)', font: '700 16px var(--font-body)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
} as const;

/** Content-only — a parent renders this inside a BottomSheet gated on
 * state.addSubOpen (mirrors how sibling detail modals in this directory work).
 * A segmented toggle at the top switches the form between a plain recurring
 * subscription and a fixed-term installment plan; both save into the same
 * ob.subs array via actions.addSubscription, discriminated by draft.kind. */
export function AddSubModal() {
  const { state } = useStore();
  const actions = useActions();

  const [amountKeypad, setAmountKeypad] = useState(false);

  if (!state.addSubOpen) return null;
  const draft = state.ob.subDraft;
  const isPlan = draft.kind === 'plan';

  const setKind = (k: 'subscription' | 'plan') => {
    actions.setSubDraft('kind', k);
    // Plans are always billed monthly for the MVP — default it on open.
    if (k === 'plan') actions.setSubDraft('frequency', 'Monthly');
  };

  const totalInst = Number(draft.totalInstallments) || 0;
  const paidInst = Number(draft.paidInstallments) || 0;
  const payoffIso = planPayoffDate(draft.startDate, totalInst, draft.frequency || 'Monthly');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 20px 24px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17 }}>
          {isPlan ? 'Add installment plan' : 'Add subscription'}
        </span>
        <button type="button" onClick={actions.closeAddSub} aria-label="Close" className="pressable" style={{ background: 'none', border: 'none', padding: 8, marginRight: -8, cursor: 'pointer', color: 'var(--color-text)' }}>
          <CloseIcon />
        </button>
      </div>

      <div role="tablist" aria-label="Type" style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--color-neutral-200)', borderRadius: 10, marginBottom: 16 }}>
        {(['subscription', 'plan'] as const).map((k) => {
          const active = isPlan === (k === 'plan');
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setKind(k)}
              style={{
                flex: 1, border: 'none', cursor: 'pointer', borderRadius: 8, padding: '8px 10px',
                font: '700 12px var(--font-body)',
                background: active ? 'var(--color-surface)' : 'transparent',
                color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
                boxShadow: active ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {k === 'subscription' ? 'Subscription' : 'Installment plan'}
            </button>
          );
        })}
      </div>

      {isPlan ? (
        <>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Provider</label>
            <select className="input" value={draft.provider ?? 'Atome'} onChange={(e) => actions.setSubDraft('provider', e.target.value)}>
              {INSTALLMENT_PROVIDER_OPTS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Name</label>
            <input className="input" value={draft.name} onChange={(e) => actions.setSubDraft('name', e.target.value)} placeholder="e.g. iPhone 16" />
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Total amount (RM)</label>
            <input
              className="input"
              inputMode="decimal"
              value={draft.totalAmount ?? ''}
              onChange={(e) => actions.setSubDraft('totalAmount', e.target.value)}
              placeholder="e.g. 4,199"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ font: '600 11px var(--font-body)', color: 'var(--color-text-muted)', marginBottom: 7, letterSpacing: '0.01em' }}>Number of installments</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {INSTALLMENT_TENURE_OPTS.map((n) => {
                const active = totalInst === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => actions.setSubDraft('totalInstallments', n)}
                    style={{
                      border: '1px solid ' + (active ? 'var(--color-accent)' : 'var(--color-neutral-400)'),
                      background: active ? 'var(--color-accent)' : 'var(--color-surface)',
                      color: active ? '#fff' : 'var(--color-text)',
                      borderRadius: 999, padding: '6px 14px', font: '700 12px var(--font-body)', cursor: 'pointer',
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <div className="field">
              <label>Custom count</label>
              <input
                className="input"
                type="number"
                min={1}
                inputMode="numeric"
                value={draft.totalInstallments || ''}
                onChange={(e) => actions.setSubDraft('totalInstallments', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                placeholder="e.g. 9"
              />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Installment amount (RM)</label>
            <input
              className="input"
              inputMode="decimal"
              value={draft.amount}
              onChange={(e) => actions.setSubDraft('amount', e.target.value)}
              placeholder="auto from total ÷ count"
            />
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>First payment date</label>
            <input className="input" type="date" value={draft.startDate} onChange={(e) => actions.setSubDraft('startDate', e.target.value)} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ font: '600 11px var(--font-body)', color: 'var(--color-text-muted)', marginBottom: 7, letterSpacing: '0.01em' }}>Already paid</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                type="button"
                aria-label="Fewer paid"
                className="pressable"
                style={stepBtnStyle}
                onClick={() => actions.setSubDraft('paidInstallments', Math.max(0, paidInst - 1))}
              >
                −
              </button>
              <span className="type-numeric" style={{ fontWeight: 700, fontSize: 15, minWidth: 52, textAlign: 'center' }}>
                {paidInst} / {totalInst}
              </span>
              <button
                type="button"
                aria-label="More paid"
                className="pressable"
                style={stepBtnStyle}
                onClick={() => actions.setSubDraft('paidInstallments', Math.min(totalInst, paidInst + 1))}
              >
                +
              </button>
            </div>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Payment method</label>
            <select className="input" value={draft.method} onChange={(e) => actions.setSubDraft('method', e.target.value)}>
              {paymentMethodOptions(state.ob.manual, draft.method).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label>Category</label>
            <select className="input" value={draft.category} onChange={(e) => actions.setSubDraft('category', e.target.value)}>
              {SUB_CATEGORY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          {(parseFloat(draft.amount) > 0 && totalInst > 0) && (
            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
              RM {formatWithCommas((parseFloat(draft.amount) || 0).toFixed(2))} × {totalInst}
              {' · '}RM {formatWithCommas(planRemainingBalance({ amount: draft.amount, frequency: draft.frequency, totalInstallments: totalInst, paidInstallments: paidInst }).toFixed(2))} left
              {payoffIso ? ` · done ${isoToDisplayDate(payoffIso).replace(/^\d+\s/, '')}` : ''}
            </div>
          )}

          <button type="button" onClick={actions.addSubscription} className="btn btn-primary btn-lg">Add installment plan</button>
        </>
      ) : (
        <>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Name</label>
            <input className="input" value={draft.name} onChange={(e) => actions.setSubDraft('name', e.target.value)} placeholder="e.g. Netflix" />
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Amount (RM)</label>
              <button
                type="button"
                onClick={() => setAmountKeypad(true)}
                className="input"
                style={{ display: 'flex', alignItems: 'center', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}
              >
                <span style={{ color: draft.amount ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                  {draft.amount ? formatWithCommas(draft.amount) : '0.00'}
                </span>
              </button>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Frequency</label>
              <select className="input" value={draft.frequency} onChange={(e) => actions.setSubDraft('frequency', e.target.value)}>
                {SUB_FREQUENCY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Payment method</label>
            <select className="input" value={draft.method} onChange={(e) => actions.setSubDraft('method', e.target.value)}>
              {paymentMethodOptions(state.ob.manual, draft.method).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 20 }}>
            <label>Category</label>
            <select className="input" value={draft.category} onChange={(e) => actions.setSubDraft('category', e.target.value)}>
              {SUB_CATEGORY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <button type="button" onClick={actions.addSubscription} className="btn btn-primary btn-lg">Add subscription</button>
        </>
      )}

      <AmountKeypadSheet
        open={amountKeypad}
        value={draft.amount}
        onClose={() => setAmountKeypad(false)}
        onSave={(v) => actions.setSubDraft('amount', v)}
      />
    </div>
  );
}
