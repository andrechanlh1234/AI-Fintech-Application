import { useStore, useActions } from '../../store/StoreProvider';

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

const DONATE_AMOUNTS = ['5', '10', '20', '50'];

/** Content-only — a parent renders this inside a BottomSheet gated on
 * state.donateOpen (mirrors how sibling detail modals in this directory work). */
export function DonateModal() {
  const { state } = useStore();
  const actions = useActions();

  if (!state.donateOpen) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 20px 24px', boxSizing: 'border-box', minHeight: 420 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button type="button" onClick={actions.closeDonate} aria-label="Close" className="pressable" style={{ background: 'none', border: 'none', padding: 8, marginRight: -8, cursor: 'pointer', color: 'var(--color-text)' }}>
          <CloseIcon />
        </button>
      </div>

      {!state.donateDone && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--color-neutral-200)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 21 }}>Support Cukai</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', maxWidth: '26ch', lineHeight: 1.5 }}>
            Cukai is free to use. If it's saved you time or money, consider chipping in to help keep it running.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {DONATE_AMOUNTS.map((v) => {
              const active = state.donateAmount === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => actions.setDonateAmount(v)}
                  className="pressable"
                  style={{
                    padding: '10px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    font: '700 13px var(--font-body)',
                    border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-neutral-300)'}`,
                    background: active ? 'var(--color-accent-100)' : 'var(--color-surface)',
                    color: active ? 'var(--color-accent-700)' : 'var(--color-text)',
                  }}
                >
                  RM{v}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={actions.submitDonate} className="btn btn-primary btn-lg" style={{ marginTop: 8, width: '100%' }}>
            Donate RM{state.donateAmount}
          </button>
        </div>
      )}

      {state.donateDone && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--color-neutral-200)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 20 }}>Thank you!</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', maxWidth: '26ch' }}>
            Your RM{state.donateAmount} contribution helps keep Cukai free for everyone.
          </div>
          <button type="button" onClick={actions.closeDonate} className="btn btn-secondary" style={{ marginTop: 8 }}>Done</button>
        </div>
      )}
    </div>
  );
}
