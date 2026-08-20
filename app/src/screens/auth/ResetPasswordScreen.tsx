import { useState } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';

// Shown instead of the normal app whenever the URL carries ?reset_token=
// (i.e. the user just clicked the link in a password-reset email) —
// independent of whether they're currently signed in, mid-onboarding, or
// this is a brand new browser session.
export function ResetPasswordScreen() {
  const { state } = useStore();
  const actions = useActions();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      await actions.completePasswordReset(password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-theme={state.theme} style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 22px', boxSizing: 'border-box', textAlign: 'center' }}>
        {done ? (
          <>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 24, marginBottom: 10 }}>Password updated</div>
            <div style={{ fontSize: 13.5, color: 'var(--color-text-muted)', marginBottom: 24, maxWidth: '30ch' }}>
              You can log in with your new password now.
            </div>
            <button type="button" onClick={actions.cancelPasswordReset} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
              Go to login
            </button>
          </>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 24, marginBottom: 6 }}>Set a new password</div>
            <div style={{ fontSize: 13.5, color: 'var(--color-text-muted)', marginBottom: 24, maxWidth: '32ch' }}>
              Choose a new password for your account.
            </div>
            <form onSubmit={submit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                className="input" type="password" placeholder="New password (min. 8 characters)" value={password} required minLength={8}
                autoComplete="new-password" onChange={(e) => setPassword(e.target.value)}
              />
              <input
                className="input" type="password" placeholder="Confirm new password" value={confirm} required minLength={8}
                autoComplete="new-password" onChange={(e) => setConfirm(e.target.value)}
              />
              {error && <div style={{ fontSize: 12, color: 'var(--color-danger-700)' }}>{error}</div>}
              <button type="submit" className="btn btn-primary btn-lg" disabled={busy} style={{ marginTop: 4 }}>
                {busy ? 'Please wait…' : 'Set new password'}
              </button>
            </form>
            <button
              type="button" onClick={actions.cancelPasswordReset} className="pressable"
              style={{ background: 'none', border: 'none', padding: 8, marginTop: 14, font: '600 13px var(--font-body)', color: 'var(--color-text-muted)', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
