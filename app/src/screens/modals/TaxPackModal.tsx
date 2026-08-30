import { useStore, useActions } from '../../store/StoreProvider';
import { Tag, Button } from '../../components/primitives';

// Ported from Cukai v7.dc.html lines 618-634 (taxPackOpen modal).
// Simple premium-upsell panel; upgrade routes through actions.upgradeFromTaxPack().
export function TaxPackModal() {
  const { state } = useStore();
  const actions = useActions();
  if (!state.taxPackOpen) return null;

  return (
    <div
      className="screen-in"
      style={{
        position: 'absolute', inset: 0, zIndex: 47, background: 'var(--color-bg)',
        display: 'flex', flexDirection: 'column', padding: 'calc(env(safe-area-inset-top) + 16px) 20px 24px', boxSizing: 'border-box', overflow: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          type="button"
          onClick={actions.closeTaxPack}
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 14 }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--color-neutral-200)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </div>
        <Tag variant="accent">Premium Feature</Tag>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 21 }}>Tax Pack</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', maxWidth: '26ch', lineHeight: 1.5 }}>
          A single export of every receipt and relief total, organised and ready for e-Filing.
        </div>
        <Button variant="primary" onClick={actions.upgradeFromTaxPack} style={{ marginTop: 8 }} block>
          Upgrade to Premium
        </Button>
      </div>
    </div>
  );
}
