import { useState } from 'react';
import { http } from '../../api/http';
import { validateEmail, validatePassword } from '../../utils/formValidation';

export default function MaterialSignIn({ onSignedIn, heading = 'Sign in' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  function change(field, value) {
    if (field === 'email') setEmail(value);
    else setPassword(value);
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    const nextErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };
    if (nextErrors.email || nextErrors.password) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    setBusy(true);
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
        <input type="email" autoComplete="username" value={email} onChange={(event) => change('email', event.target.value)} aria-invalid={Boolean(fieldErrors.email)} />
      </label>
      {fieldErrors.email && <span role="alert">{fieldErrors.email}</span>}
      <label>Password
        <input type="password" autoComplete="current-password" value={password} onChange={(event) => change('password', event.target.value)} aria-invalid={Boolean(fieldErrors.password)} />
      </label>
      {fieldErrors.password && <span role="alert">{fieldErrors.password}</span>}
      <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
