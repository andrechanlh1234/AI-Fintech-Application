export function UnableToScanStep({ onSnapAgain, onAddCustomAmount }: {
  onSnapAgain: () => void;
  onAddCustomAmount: () => void;
}) {
  return (
    <div className="screen-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 20px 24px', boxSizing: 'border-box', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, margin: '0 auto' }}>Review receipt</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 20 }}>
        <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'var(--color-danger-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" /><path d="M12 17h.01" />
          </svg>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Unable to read receipt</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', maxWidth: '30ch' }}>
            This doesn't look like a supported receipt. Try again with another receipt or enter items manually.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="button" onClick={onSnapAgain} className="btn btn-primary btn-lg">Snap again</button>
        <button type="button" onClick={onAddCustomAmount} className="btn btn-secondary btn-lg">Add custom amount</button>
      </div>
    </div>
  );
}
