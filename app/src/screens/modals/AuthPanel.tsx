import { useActions } from '../../store/StoreProvider';
import { AuthForm } from '../../components/AuthForm';

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
    </div>
  );
}
