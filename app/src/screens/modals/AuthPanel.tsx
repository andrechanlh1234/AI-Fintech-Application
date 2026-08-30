import { useActions } from '../../store/StoreProvider';
import { AuthForm } from '../../components/AuthForm';
import { googleLoginUrl } from '../../lib/api';

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

// Entry point for guests who hit "Skip for now" during onboarding and
// later decide they want their data to survive beyond this one browser.
export function AuthPanel() {
  const actions = useActions();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 20px 28px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17 }}>Sign in</span>
        <button type="button" onClick={actions.closeAuthPanel} aria-label="Close" className="pressable" style={{ background: 'none', border: 'none', padding: 8, marginRight: -8, cursor: 'pointer', color: 'var(--color-text)' }}>
          <CloseIcon />
        </button>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
        Right now your data only lives in this browser. Create an account (or log in) to keep it — and everything you've entered here comes with you.
      </div>
      <AuthForm onSuccess={actions.closeAuthPanel} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', margin: '14px 0 6px' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--color-neutral-300)' }} />
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>or</span>
        <div style={{ flex: 1, height: 1, background: 'var(--color-neutral-300)' }} />
      </div>
      <button
        type="button" onClick={() => { window.location.href = googleLoginUrl(); }} className="pressable"
        style={{ width: '100%', padding: 15, background: '#fff', border: '1.5px solid var(--color-neutral-400)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, font: '600 14px var(--font-body)', cursor: 'pointer', boxSizing: 'border-box' }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.67-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.98 10.98 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.19V7.06H2.18a11 11 0 0 0 0 9.87l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a10.98 10.98 0 0 0-9.82 6.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
        </svg>
        Continue with Google
      </button>
    </div>
  );
}
