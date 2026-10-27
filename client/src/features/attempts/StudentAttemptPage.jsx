import { useCallback, useRef, useState } from 'react';
import { http } from '../../api/http';
import AttemptPage from './AttemptPage';
import StudentInsights from './StudentInsights';
import { loadAttemptQuiz, submitAttempt } from './attemptApi';
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

  async function signIn(event) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
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
    <form onSubmit={signIn}>
      <fieldset disabled={busy}>
        <legend>Student account</legend>
        <label>Email <input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label>
        <label>Password <input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
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
        if (/^[a-f\d]{24}$/i.test(quizId.trim())) {
          setOpenedId(quizId.trim());
          setNotice('');
        } else setNotice('Enter a valid 24-character quiz ID.');
      }}>
        <label>Published quiz ID <input required value={quizId} onChange={event => setQuizId(event.target.value)} /></label>
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