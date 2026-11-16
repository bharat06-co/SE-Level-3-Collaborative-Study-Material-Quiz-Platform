import { useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../../api/http';
import { validateEmail } from '../../utils/formValidation';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const next = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (trimmedName.length < 2 || trimmedName.length > 60) next.name = 'Name must be 2–60 characters.';
    const emailError = validateEmail(trimmedEmail);
    if (emailError) next.email = emailError;
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || new TextEncoder().encode(password).length > 72) {
      next.password = 'Password needs at least 8 characters with a letter and digit, and cannot exceed 72 bytes.';
    }
    if (password !== confirm) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await http.post('/auth/register', { name: trimmedName, email: trimmedEmail, password });
      setPassword('');
      setConfirm('');
      setSuccess(true);
    } catch (error) {
      setErrors({ server: error.response?.data?.error?.message || 'Registration failed. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  return <main className="shell auth-shell">
    <Link to="/">← Home</Link>
    <h1>Create an account</h1>
    {success ? <section><p role="status">Account created. Sign in to continue.</p><Link to="/profile">Sign in</Link></section> : (
      <form onSubmit={submit} noValidate>
        {errors.server && <p role="alert">{errors.server}</p>}
        <label htmlFor="register-name">Full name</label>
        <input id="register-name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'register-name-error' : undefined} autoComplete="name" maxLength={60} value={name} onChange={event => setName(event.target.value)} />
        {errors.name && <p id="register-name-error" role="alert">{errors.name}</p>}
        <label htmlFor="register-email">Email</label>
        <input id="register-email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'register-email-error' : undefined} type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} />
        {errors.email && <p id="register-email-error" role="alert">{errors.email}</p>}
        <label htmlFor="register-password">Password</label>
        <input id="register-password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'register-password-error' : undefined} type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} />
        {errors.password && <p id="register-password-error" role="alert">{errors.password}</p>}
        <label htmlFor="register-confirm">Confirm password</label>
        <input id="register-confirm" aria-invalid={Boolean(errors.confirm)} aria-describedby={errors.confirm ? 'register-confirm-error' : undefined} type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} />
        {errors.confirm && <p id="register-confirm-error" role="alert">{errors.confirm}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Register'}</button>
      </form>
    )}
    {!success && <p><Link to="/profile">Already registered? Sign in</Link></p>}
  </main>;
}
