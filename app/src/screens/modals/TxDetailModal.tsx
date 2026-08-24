import { useStore, useActions } from '../../store/StoreProvider';
import { CATEGORY_OPTIONS, paymentMethodOptions } from '../../lib/constants';

// Tap a transaction row in Record to open this: edit every field a scan/
// manual entry can set, or delete it outright. Saving/deleting writes
// straight to state.transactions -- the single source of truth every other
// screen (budgets, stats, tax, net worth) derives its numbers from, so a
// category/date/amount change here cascades everywhere automatically.
export function TxDetailModal() {
  const { state } = useStore();
  const actions = useActions();

  if (!state.txDetailOpen) return null;
  const draft = state.txDraft;
  const isExpense = draft.type === 'expense';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 20px 24px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button
          type="button"
          onClick={actions.closeTxDetail}
          aria-label="Back"
          className="pressable"
          style={{ background: 'none', border: 'none', padding: 8, marginLeft: -8, cursor: 'pointer', color: 'var(--color-text)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18 }}>Edit transaction</span>
      </div>

      <div className="seg" style={{ marginBottom: 16, width: '100%' }}>
        <label
          className="seg-opt"
          style={{ flex: 1, justifyContent: 'center', background: isExpense ? 'var(--color-text)' : 'transparent', color: isExpense ? '#fff' : 'var(--color-text)' }}
        >
          <input type="radio" name="txType" checked={isExpense} onChange={() => actions.setTxDraftField('type', 'expense')} />
          Expense
        </label>
        <label
          className="seg-opt"
          style={{ flex: 1, justifyContent: 'center', background: !isExpense ? 'var(--color-accent)' : 'transparent', color: !isExpense ? '#fff' : 'var(--color-text)' }}
        >
          <input type="radio" name="txType" checked={!isExpense} onChange={() => actions.setTxDraftField('type', 'income')} />
          Income
        </label>
      </div>

      <div className="field" style={{ marginBottom: 14 }}>
        <label>Merchant / description</label>
        <input className="input" value={draft.merchant} onChange={(e) => actions.setTxDraftField('merchant', e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Amount (RM)</label>
          <input className="input" value={draft.amount} onChange={(e) => actions.setTxDraftField('amount', e.target.value)} placeholder="0.00" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Date</label>
          <input className="input" type="date" value={draft.date} onChange={(e) => actions.setTxDraftField('date', e.target.value)} />
        </div>
      </div>

      {isExpense && (
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Category</label>
          <select className="input" value={draft.cat} onChange={(e) => actions.setTxDraftField('cat', e.target.value)}>
            {CATEGORY_OPTIONS.filter((c) => c !== 'Income').map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )}

      <div className="field" style={{ marginBottom: 14 }}>
        <label>Payment method</label>
        <select className="input" value={draft.payment} onChange={(e) => actions.setTxDraftField('payment', e.target.value)}>
          {paymentMethodOptions(state.ob.manual, draft.payment).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      {isExpense && (
        <div
          style={{
            border: `1.5px solid ${draft.tax ? 'var(--color-tax-300)' : 'var(--color-neutral-300)'}`,
            background: draft.tax ? 'var(--color-tax-100)' : 'var(--color-surface)',
            borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 20,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Tax deductible?</div>
          <div className="seg">
            <label className="seg-opt">
              <input type="radio" name="txDeductible" checked={draft.tax} onChange={() => actions.setTxDraftField('tax', true)} />
              Yes
            </label>
            <label className="seg-opt">
              <input type="radio" name="txDeductible" checked={!draft.tax} onChange={() => actions.setTxDraftField('tax', false)} />
              No
            </label>
          </div>
        </div>
      )}

      <button type="button" onClick={actions.saveTxDetail} className="btn btn-primary" style={{ marginBottom: 20 }}>
        Save changes
      </button>

      <button
        type="button"
        onClick={actions.deleteTxDetail}
        className="pressable"
        style={{ all: 'unset', cursor: 'pointer', display: 'block', color: 'var(--color-danger-700)', font: '600 12.5px var(--font-body)' }}
      >
        Delete transaction
      </button>
    </div>
  );
}
