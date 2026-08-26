export function ProcessingStep({ photoUrl }: { photoUrl: string | null }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0f100f', position: 'relative', overflow: 'hidden', minHeight: '100vh' }}>
      {photoUrl && (
        <img
          src={photoUrl}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35, filter: 'blur(1px)' }}
        />
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, position: 'relative' }}>
        <div
          style={{
            width: 44, height: 44, borderRadius: '50%',
            border: '3.5px solid rgba(255,255,255,0.2)', borderTopColor: '#fff',
            animation: 'spin 0.85s linear infinite',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <span style={{ font: '600 14px var(--font-body)', color: '#fff' }}>
            Reading your receipt
            <span style={{ animation: 'dotBlink 1.4s infinite' }}>.</span>
            <span style={{ animation: 'dotBlink 1.4s infinite .2s' }}>.</span>
            <span style={{ animation: 'dotBlink 1.4s infinite .4s' }}>.</span>
          </span>
          <span style={{ font: '400 12px var(--font-body)', color: 'rgba(255,255,255,0.5)' }}>Cukai is finding the merchant, amount and category</span>
        </div>
      </div>
    </div>
  );
}
