export function PreviewStep({ photoUrl, onSnapAgain, onContinue }: {
  photoUrl: string;
  onSnapAgain: () => void;
  onContinue: () => void;
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg,#2a2c2b,#0f100f)', position: 'relative', overflow: 'hidden', minHeight: '100dvh' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: 'calc(env(safe-area-inset-top) + 16px) 18px 16px' }}>
        <button
          type="button"
          onClick={onSnapAgain}
          aria-label="Back"
          className="pressable"
          style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"></path></svg>
        </button>
      </div>
      <div style={{ flex: 1, margin: '0 24px', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
        <img src={photoUrl} alt="Captured receipt" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, padding: '22px 24px 34px' }}>
        <button type="button" onClick={onSnapAgain} className="pressable" style={{ flex: 1, background: 'transparent', border: '1.5px solid rgba(255,255,255,0.4)', borderRadius: 'var(--radius-md)', padding: '13px 0', color: '#fff', font: '700 14px var(--font-body)', cursor: 'pointer' }}>
          Snap again
        </button>
        <button type="button" onClick={onContinue} className="pressable" style={{ flex: 1, background: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '13px 0', color: 'var(--color-accent-800)', font: '700 14px var(--font-body)', cursor: 'pointer' }}>
          Continue
        </button>
      </div>
    </div>
  );
}
