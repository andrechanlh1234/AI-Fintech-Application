import { useStore, useActions } from '../../store/StoreProvider';
import { SUB_FREQUENCY_OPTIONS, SUB_CATEGORY_OPTIONS, PAYMENT_METHODS } from '../../lib/constants';

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/** Content-only — a parent renders this inside a BottomSheet gated on
 * state.addSubOpen (mirrors how sibling detail modals in this directory work). */
export function AddSubModal() {
  const { state } = useStore();
  const actions = useActions();

  if (!state.addSubOpen) return null;
  const draft = state.ob.subDraft;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 20px 24px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17 }}>Add subscription</span>
        <button type="button" onClick={actions.closeAddSub} aria-label="Close" className="pressable" style={{ background: 'none', border: 'none', padding: 8, marginRight: -8, cursor: 'pointer', color: 'var(--color-text)' }}>
          <CloseIcon />
        </button>
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>Name</label>
        <input className="input" value={draft.name} onChange={(e) => actions.setSubDraft('name', e.target.value)} placeholder="e.g. Netflix" />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Amount (RM)</label>
          <input className="input" value={draft.amount} onChange={(e) => actions.setSubDraft('amount', e.target.value)} placeholder="0.00" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Frequency</label>
          <select className="input" value={draft.frequency} onChange={(e) => actions.setSubDraft('frequency', e.target.value)}>
            {SUB_FREQUENCY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Start date</label>
          <input className="input" type="date" value={draft.startDate} onChange={(e) => actions.setSubDraft('startDate', e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Next payment</label>
          <input className="input" type="date" value={draft.nextPayment} onChange={(e) => actions.setSubDraft('nextPayment', e.target.value)} />
        </div>
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>Payment method</label>
        <select className="input" value={draft.method} onChange={(e) => actions.setSubDraft('method', e.target.value)}>
          {PAYMENT_METHODS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>

      <div className="field" style={{ marginBottom: 20 }}>
        <label>Category</label>
        <select className="input" value={draft.category} onChange={(e) => actions.setSubDraft('category', e.target.value)}>
          {SUB_CATEGORY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>

      <button type="button" onClick={actions.addSubscription} className="btn btn-primary btn-lg">Add subscription</button>
    </div>
  );
}
