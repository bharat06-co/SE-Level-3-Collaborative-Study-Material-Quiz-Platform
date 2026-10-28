import { useState } from 'react';
import { http } from '../../api/http';

export default function MaterialSignIn({ onSignedIn, heading = 'Sign in' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await http.post('/auth/login', { email, password });
      const { accessToken, user } = response.data;
      if (typeof accessToken !== 'string' || !accessToken || !user) {
        throw new Error('Incomplete login response.');
      }
      setPassword('');
      onSignedIn({ token: accessToken, user });
    } catch (loginError) {
      setError(loginError.response?.data?.error?.message || 'Sign in failed. Check your details and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="material-signin" onSubmit={submit} noValidate aria-label={heading}>
      <h2>{heading}</h2>
      {error && <p role="alert">{error}</p>}
      <label>Email
        <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>Password
        <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
