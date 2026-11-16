import { useCallback, useState } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { http } from '../../api/http';
import { MaterialSessionProvider, useMaterialSession, useOptionalMaterialSession } from '../materials/MaterialSession';
import AttemptPage from './AttemptPage';
import StudentInsights from './StudentInsights';
import { loadAttemptQuiz, submitAttempt } from './attemptApi';
import { validateEmail, validateObjectId, validatePassword } from '../../utils/formValidation';
import './attempts.css';

export default function StudentAttemptPage(props) {
  const sessionContext = useOptionalMaterialSession();
  const page = <StudentAttemptView {...props} />;
  return sessionContext ? page : <MaterialSessionProvider>{page}</MaterialSessionProvider>;
}

function StudentAttemptView({ quizId: routeQuizId }) {
  const inRouter = useInRouterContext();
  const { session: auth, signIn: storeSession, clearSession, logout } = useMaterialSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [quizId, setQuizId] = useState(routeQuizId || '');
  const [openedId, setOpenedId] = useState(routeQuizId || '');
  const [busy, setBusy] = useState(false);
  const [dataRevision, setDataRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [quizIdError, setQuizIdError] = useState('');
  const token = auth?.token;

  const guardedRequest = useCallback(async (action) => {
    try { return await action(); }
    catch (error) {
      if (error.response?.status === 401 && token) {
        clearSession(token);
        setNotice('Your session has expired. Sign in again.');
      }
      throw error;
    }
  }, [token, clearSession]);
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
      storeSession({ token: data.accessToken, user: data.user });
    } catch (error) {
      setNotice(error.response?.data?.error?.message || 'Sign in failed. Try again.');
    } finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true);
    setNotice('Signing out…');
    const revoked = await logout();
    setNotice(revoked ? 'Signed out.' : 'Signed out locally, but server session revocation could not be confirmed.');
    setBusy(false);
  }

  if (!auth) return <main className="attempt-shell">
    {inRouter ? <Link to="/">Platform home</Link> : <a href="/">Platform home</a>}
    <h1>Sign in to attempt a quiz</h1>
    <p>New student? <a href="/register">Create an account</a></p>
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
    clearSession(token);
    setNotice('Your session has expired. Sign in again.');
  };

  if (auth.user.role !== 'student') return <main className="attempt-shell">
    {inRouter && <Link to="/">Platform home</Link>}
    <p role="alert">Only students, including student contributors, can submit attempts.</p>
    <button type="button" onClick={signOut}>Sign out</button>
  </main>;

  return <>
    <section className="attempt-shell" aria-label="Student session">
      {inRouter && !openedId && <Link to="/">Platform home</Link>}
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