import { useState } from 'react';
import { useActions } from '../store/StoreProvider';

// Real email/password signup + login, shared by the onboarding login step
// and the "Sign in" entry point in More (for guests who skipped it).
export function AuthForm({ onSuccess }: { onSuccess: () => void }) {
  const actions = useActions();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signup') await actions.authSignup(email.trim(), password);
      else await actions.authLogin(email.trim(), password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="seg" style={{ marginBottom: 4, alignSelf: 'center' }}>
        <label className="seg-opt">
          <input type="radio" name="authMode" checked={mode === 'signup'} onChange={() => setMode('signup')} />
          Create account
        </label>
        <label className="seg-opt">
          <input type="radio" name="authMode" checked={mode === 'login'} onChange={() => setMode('login')} />
          Log in
        </label>
      </div>
      <input
        className="input" type="email" placeholder="Email" value={email} required autoComplete="email"
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="input" type="password" placeholder="Password (min. 8 characters)" value={password} required
        minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <div style={{ fontSize: 12, color: 'var(--color-danger-700)' }}>{error}</div>}
      <button type="submit" className="btn btn-primary btn-lg" disabled={busy} style={{ marginTop: 4 }}>
        {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
      </button>
    </form>
  );
}
