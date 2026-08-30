import { useStore } from '../../store/StoreProvider';

/** Full-screen loading cover shown while an uploaded bank/credit-card/
 * e-wallet statement is being parsed server-side (state.statementUploading).
 * Mirrors scan/ProcessingStep's look — dark ground, a CSS `spin` ring, the
 * blinking-dots line — but with no image, since a statement upload has no
 * photo to blur behind it. Sits above the tab bar; self-gates. */
export function StatementImportOverlay() {
  const { state } = useStore();
  if (!state.statementUploading) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60, background: '#0f100f',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18,
        padding: 'env(safe-area-inset-top) 24px env(safe-area-inset-bottom)', boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: 44, height: 44, borderRadius: '50%',
          border: '3.5px solid rgba(255,255,255,0.2)', borderTopColor: '#fff',
          animation: 'spin 0.85s linear infinite',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
        <span style={{ font: '600 14px var(--font-body)', color: '#fff' }}>
          Reading your statement
          <span style={{ animation: 'dotBlink 1.4s infinite' }}>.</span>
          <span style={{ animation: 'dotBlink 1.4s infinite .2s' }}>.</span>
          <span style={{ animation: 'dotBlink 1.4s infinite .4s' }}>.</span>
        </span>
        <span style={{ font: '400 12px var(--font-body)', color: 'rgba(255,255,255,0.5)' }}>
          Cukai is sorting transactions and categories
        </span>
      </div>
    </div>
  );
}
