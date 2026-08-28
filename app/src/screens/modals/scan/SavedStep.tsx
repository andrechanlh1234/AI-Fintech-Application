import { useStore, useActions } from '../../../store/StoreProvider';

export function SavedStep({ onScanAnother }: { onScanAnother: () => void }) {
  const { state } = useStore();
  const actions = useActions();
  const lastReceipt = state.receipts[state.receipts.length - 1];
  const savedTx = lastReceipt ? state.transactions.filter((t) => t.receiptId === lastReceipt.id) : [];
  const anyDeductible = savedTx.some((t) => t.tax);

  return (
    <div
      className="screen-in"
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: 'calc(env(safe-area-inset-top) + 24px) 24px calc(env(safe-area-inset-bottom) + 24px)',
        boxSizing: 'border-box', textAlign: 'center', minHeight: '100dvh',
      }}
    >
      {/* Hero (tick + Saved + subtitle) is centred in the space above the
          transaction list — the tick used to be glued near the top. */}
      <div style={{ flex: 1, minHeight: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div
          className="success-ring"
          style={{ width: 76, height: 76, borderRadius: '50%', background: 'var(--color-accent-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-700)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path className="success-check" d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22, marginBottom: 6 }}>Saved</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', maxWidth: '26ch' }}>
          {savedTx.length === 1 ? 'Linked to a new transaction in your Finance tab.' : `Split into ${savedTx.length} transactions in your Finance tab.`}
        </div>
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20, marginBottom: 14 }}>
        {savedTx.map((tx) => (
          <div key={tx.id} className="card elev-sm" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{tx.merchant}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{tx.cat} · {tx.dateLabel}</div>
              </div>
              <div className="type-numeric" style={{ fontWeight: 700, fontSize: 15 }}>−RM {Math.abs(tx.amount).toFixed(2)}</div>
            </div>
            {tx.tax && <div className="tag tag-tax" style={{ alignSelf: 'flex-start', marginTop: 6 }}>Potentially deductible</div>}
          </div>
        ))}
      </div>

      {anyDeductible && (
        <button
          type="button"
          onClick={actions.viewInTax}
          className="pressable"
          style={{ width: '100%', textAlign: 'left', background: 'var(--color-tax-100)', border: '1.5px solid var(--color-tax-300)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', boxSizing: 'border-box' }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-tax-800)' }}>Added to your potential deductions</div>
            <div style={{ fontSize: 11, color: 'var(--color-tax-700)', marginTop: 2 }}>Tap to see it in your Tax Center</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-tax-700)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
        </button>
      )}

      <div style={{ flex: 1, minHeight: 16 }} />
      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        <button type="button" onClick={onScanAnother} className="btn btn-secondary" style={{ flex: 1, padding: '16px 18px', fontSize: 15, borderRadius: 'var(--radius-md)' }}>Scan another</button>
        <button type="button" onClick={actions.closeScan} className="btn btn-primary" style={{ flex: 1, padding: '16px 18px', fontSize: 15, borderRadius: 'var(--radius-md)' }}>Done</button>
      </div>
    </div>
  );
}
