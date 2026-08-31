import { useState } from 'react';
import { useActions } from '../store/StoreProvider';

// Real email/password signup + login, shared by the onboarding login step
// and the "Sign in" entry point in More (for guests who skipped it).
export function AuthForm({ onSuccess }: { onSuccess: () => void }) {
  const actions = useActions();
  const [mode, setMode] = useState<'signup' | 'login' | 'forgot'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Forgot-password is two steps: request a code by email, then enter the
  // code + a new password. `codeSent` flips between them.
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'forgot') {
        if (!codeSent) {
          await actions.requestPasswordReset(email.trim());
          setCodeSent(true);
        } else {
          if (password !== confirmPassword) throw new Error("Passwords don't match");
          await actions.completePasswordReset(email.trim(), code, password);
          onSuccess();
        }
      } else if (mode === 'signup') {
        await actions.authSignup(email.trim(), password);
        onSuccess();
      } else {
        await actions.authLogin(email.trim(), password);
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const leaveForgot = () => {
    setMode('login'); setCodeSent(false); setError(null);
    setCode(''); setPassword(''); setConfirmPassword('');
  };

  if (mode === 'forgot') {
    return (
      <form onSubmit={submit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {codeSent ? (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 2 }}>
              If an account exists for <strong>{email.trim()}</strong>, we've emailed a 6-digit
              code. Enter it below with your new password. The code expires in 15 minutes.
            </div>
            <div className="field">
              <label>Reset code</label>
              <input
                className="input" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code"
                value={code} required pattern="[0-9]{6}" maxLength={6}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div className="field">
              <label>New password</label>
              <input
                className="input" type="password" placeholder="Min. 8 characters" value={password}
                required minLength={8} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Confirm password</label>
              <input
                className="input" type="password" placeholder="Re-enter new password" value={confirmPassword}
                required minLength={8} autoComplete="new-password" onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {error && <div style={{ fontSize: 12, color: 'var(--color-danger-700)' }}>{error}</div>}
            <button type="submit" className="btn btn-primary btn-lg" disabled={busy} style={{ marginTop: 4 }}>
              {busy ? 'Please wait…' : 'Reset password'}
            </button>
            <button
              type="button" onClick={() => { setCodeSent(false); setError(null); }} className="pressable"
              style={{ all: 'unset', cursor: 'pointer', alignSelf: 'center', color: 'var(--color-text-muted)', font: '600 12.5px var(--font-body)', padding: '4px 0' }}
            >
              Use a different email
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 2 }}>
              Enter your email and we'll send a code to reset your password.
            </div>
            <div className="field">
              <label>Email address</label>
              <input
                className="input" type="email" placeholder="you@example.com" value={email} required autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <div style={{ fontSize: 12, color: 'var(--color-danger-700)' }}>{error}</div>}
            <button type="submit" className="btn btn-primary btn-lg" disabled={busy} style={{ marginTop: 4 }}>
              {busy ? 'Please wait…' : 'Send reset code'}
            </button>
          </>
        )}
        <button
          type="button" onClick={leaveForgot} className="pressable"
          style={{ all: 'unset', cursor: 'pointer', alignSelf: 'center', color: 'var(--color-text-muted)', font: '600 12.5px var(--font-body)', padding: '4px 0' }}
        >
          Back to log in
        </button>
      </form>
    );
  }

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
      <div className="field">
        <label>Email address</label>
        <input
          className="input" type="email" placeholder="you@example.com" value={email} required autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Password</label>
        <input
          className="input" type="password" placeholder="Min. 8 characters" value={password} required
          minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {mode === 'login' && (
        <button
          type="button" onClick={() => { setMode('forgot'); setError(null); }} className="pressable"
          style={{ all: 'unset', cursor: 'pointer', alignSelf: 'flex-end', color: 'var(--color-text-muted)', font: '600 12px var(--font-body)' }}
        >
          Forgot password?
        </button>
      )}
      {error && <div style={{ fontSize: 12, color: 'var(--color-danger-700)' }}>{error}</div>}
      <button type="submit" className="btn btn-primary btn-lg" disabled={busy} style={{ marginTop: 4 }}>
        {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
      </button>
    </form>
  );
}
