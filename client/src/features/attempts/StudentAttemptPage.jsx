import { useCallback, useRef, useState } from 'react';
import { http } from '../../api/http';
import AttemptPage from './AttemptPage';
import StudentInsights from './StudentInsights';
import { loadAttemptQuiz, submitAttempt } from './attemptApi';
import { validateEmail, validateObjectId, validatePassword } from '../../utils/formValidation';
import './attempts.css';

// Temporary feature entry point until the shared client auth context is available.
// Tokens remain in memory, never in localStorage, sessionStorage or URLs.
export default function StudentAttemptPage({ quizId: routeQuizId }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [auth, setAuth] = useState(null);
  const [quizId, setQuizId] = useState(routeQuizId || '');
  const [openedId, setOpenedId] = useState(routeQuizId || '');
  const [busy, setBusy] = useState(false);
  const [dataRevision, setDataRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [quizIdError, setQuizIdError] = useState('');
  const activeToken = useRef(null);
  const token = auth?.token;

  const guardedRequest = useCallback(async (action) => {
    try { return await action(); }
    catch (error) {
      if (error.response?.status === 401 && activeToken.current === token) {
        activeToken.current = null;
        setAuth(null);
        setNotice('Your session has expired. Sign in again.');
      }
      throw error;
    }
  }, [token]);
  const loadQuiz = useCallback((id, options) =>
    guardedRequest(() => loadAttemptQuiz(id, { ...options, token })), [guardedRequest, token]);
  const sendAttempt = useCallback((id, answers, options) =>
    guardedRequest(() => submitAttempt(id, answers, { ...options, token })), [guardedRequest, token]);

  function changeLogin(field, value) {
    if (field === 'email') setEmail(value);
    else setPassword(value);
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function signIn(event) {
    event.preventDefault();
    setNotice('');
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
      const { data } = await http.post('/auth/login', { email, password });
      if (typeof data.accessToken !== 'string' || !data.accessToken || !data.user) {
        throw new Error('Incomplete authentication response.');
      }
      setPassword('');
      if (data.user.role !== 'student') {
        setNotice('Only students, including student contributors, can submit attempts.');
        return;
      }
      activeToken.current = data.accessToken;
      setAuth({ token: data.accessToken, user: data.user });
    } catch (error) {
      setNotice(error.response?.data?.error?.message || 'Sign in failed. Try again.');
    } finally { setBusy(false); }
  }

  async function signOut() {
    activeToken.current = null;
    setAuth(null);
    setBusy(true);
    setNotice('Signing out…');
    try {
      await http.post('/auth/logout');
      setNotice('Signed out.');
    } catch {
      setNotice('Signed out locally, but server session revocation could not be confirmed.');
    } finally { setBusy(false); }
  }

  if (!auth) return <main className="attempt-shell">
    <a href="/">Platform home</a>
    <h1>Sign in to attempt a quiz</h1>
    {notice && <p role="status">{notice}</p>}
    <form onSubmit={signIn} noValidate>
      <fieldset disabled={busy}>
        <legend>Student account</legend>
        <label>Email <input type="email" autoComplete="username" value={email} onChange={event => changeLogin('email', event.target.value)} aria-invalid={Boolean(fieldErrors.email)} /></label>
        {fieldErrors.email && <span role="alert">{fieldErrors.email}</span>}
        <label>Password <input type="password" autoComplete="current-password" value={password} onChange={event => changeLogin('password', event.target.value)} aria-invalid={Boolean(fieldErrors.password)} /></label>
        {fieldErrors.password && <span role="alert">{fieldErrors.password}</span>}
        <button type="submit">{busy ? 'Please wait…' : 'Sign in'}</button>
      </fieldset>
    </form>
  </main>;

  const expireSession = () => {
    activeToken.current = null;
    setAuth(null);
    setNotice('Your session has expired. Sign in again.');
  };

  return <>
    <section className="attempt-shell" aria-label="Student session">
      <p>Signed in as {auth.user.name}</p>
      <button type="button" onClick={signOut}>Sign out</button>
      <form onSubmit={event => {
        event.preventDefault();
        const error = validateObjectId(quizId, 'Quiz ID');
        setQuizIdError(error || '');
        if (error) return;
        setOpenedId(quizId.trim());
        setNotice('');
      }} noValidate>
        <label>Published quiz ID <input value={quizId} onChange={event => { setQuizId(event.target.value); setQuizIdError(''); }} aria-invalid={Boolean(quizIdError)} /></label>
        {quizIdError && <span role="alert">{quizIdError}</span>}
        <button type="submit">Open quiz</button>
      </form>
      {notice && <p role="status">{notice}</p>}
    </section>
    <section className="attempt-shell">
      <StudentInsights token={token} refreshKey={dataRevision} onUnauthorized={expireSession} />
    </section>
    {openedId && <AttemptPage key={`${token}:${openedId}`} quizId={openedId} token={token} loadQuiz={loadQuiz} sendAttempt={sendAttempt} onSaved={() => setDataRevision(value => value + 1)} />}
  </>;
}