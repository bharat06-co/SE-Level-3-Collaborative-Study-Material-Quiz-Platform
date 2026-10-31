import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from './auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    try {
      setLoading(true);

      const result = await requestPasswordReset(email.trim());

      setMessage(
        result.message ||
          'If an account exists with that email, password reset instructions will be sent.',
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Unable to process your request. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">ACCOUNT RECOVERY</p>

        <h1>Forgot your password?</h1>

        <p>
          Enter the email address associated with your account. If an account
          exists, we'll send you instructions to reset your password.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="reset-email">Email address</label>

          <input
            id="reset-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send reset link'}
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
