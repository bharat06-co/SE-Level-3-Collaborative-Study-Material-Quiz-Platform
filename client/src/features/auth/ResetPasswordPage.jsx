import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from './auth';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!token) {
      setError('This password reset link is invalid or missing its token.');
      return;
    }

    if (
      password.length < 8 ||
      !/[A-Za-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      setError(
        'Password must contain at least 8 characters, including a letter and a digit.',
      );
      return;
    }

    if (new TextEncoder().encode(password).length > 72) {
      setError('Password must not exceed 72 UTF-8 bytes.');
      return;
    }

    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    try {
      setLoading(true);

      const result = await resetPassword(token, password);

      setMessage(
        result.message || 'Password reset successfully. Please log in again.',
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Unable to reset your password. The link may be invalid or expired.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">ACCOUNT RECOVERY</p>

        <h1>Reset your password</h1>

        <p>Choose a new password for your account.</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="new-password">New password</label>

          <input
            id="new-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter new password"
            autoComplete="new-password"
            required
          />

          <p className="auth-hint">
            At least 8 characters, including one letter and one digit.
          </p>

          <label htmlFor="confirm-password">Confirm new password</label>

          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
            required
          />

          <button type="submit" disabled={loading || Boolean(message)}>
            {loading ? 'Resetting...' : 'Reset password'}
          </button>
        </form>

        {message && (
          <p className="auth-success" role="status">
            {message}
          </p>
        )}

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <p className="auth-back">
          <Link to="/">Back to platform home</Link>
        </p>
      </section>
    </main>
  );
}