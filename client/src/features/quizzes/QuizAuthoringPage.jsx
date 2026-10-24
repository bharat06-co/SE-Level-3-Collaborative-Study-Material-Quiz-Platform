import { useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../../api/http';
import QuizEditor from './QuizEditor';
import { getQuiz, listDraftQuizzes, saveQuiz, setQuizPublication } from './quizApi';
import './quizAuthoring.css';

export default function QuizAuthoringPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [auth, setAuth] = useState(null);
  const [drafts, setDrafts] = useState({ items: [], page: 1, total: 0, limit: 20 });
  const [selected, setSelected] = useState(null);
  const [quizId, setQuizId] = useState('');
  const [editorVersion, setEditorVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function loadDrafts(token, page = 1) {
    const result = await listDraftQuizzes(token, page);
    setDrafts(result);
  }

  async function authenticated(action) {
    try {
      return await action();
    } catch (error) {
      if (error.response?.status === 401) {
        setAuth(null);
        setSelected(null);
        setNotice('Your session has expired. Sign in again.');
      }
      throw error;
    }
  }

  async function signIn(event) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const response = await http.post('/auth/login', { email, password });
      const { accessToken, user } = response.data;
      if (typeof accessToken !== 'string' || !user) throw new Error('Incomplete login response.');
      setAuth({ token: accessToken, user });
      setPassword('');
      if (user.role === 'educator' || user.role === 'admin' || user.contributor === true) {
        try {
          await loadDrafts(accessToken);
        } catch {
          setNotice('Signed in, but drafts could not be loaded. Try refreshing the list.');
        }
      }
    } catch (error) {
      setNotice(error.response?.data?.error?.message || 'Sign in failed. Check your details and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setAuth(null);
    setSelected(null);
    setDrafts({ items: [], page: 1, total: 0, limit: 20 });
    setNotice('Signed out.');
    try { await http.post('/auth/logout'); } catch { /* Local access token is already cleared. */ }
  }

  async function refreshDrafts(page = drafts.page) {
    if (!auth) return;
    try {
      await authenticated(() => loadDrafts(auth.token, page));
      setNotice('');
    } catch (error) {
      if (error.response?.status !== 401) setNotice('Drafts could not be loaded. Try again.');
    }
  }

  async function openById(event) {
    event.preventDefault();
    if (!auth) return;
    setNotice('');
    try {
      const quiz = await authenticated(() => getQuiz(quizId.trim(), auth.token));
      if (auth.user.role !== 'admin' && quiz.authorId !== auth.user.id) {
        setNotice('Only the quiz author or an administrator can edit this quiz.');
        return;
      }
      setSelected(quiz);
      setEditorVersion((value) => value + 1);
    } catch (error) {
      if (error.response?.status !== 401) setNotice(error.response?.data?.error?.message || 'Quiz could not be opened.');
    }
  }

  const canAuthor = auth && (auth.user.role === 'educator' || auth.user.contributor === true);
  const canManage = auth && (canAuthor || auth.user.role === 'admin');

  return (
    <main className="quiz-authoring-page">
      <Link to="/">← Home</Link>
      <h1>Quiz authoring</h1>
      <p>Create a quiz draft, add questions, then publish it when the answer keys are ready.</p>
      {notice && <p role="status">{notice}</p>}
      {!auth ? (
        <form className="quiz-login" onSubmit={signIn}>
          <h2>Sign in</h2>
          <label>Email <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button type="submit" disabled={busy}>Sign in to author quizzes</button>
        </form>
      ) : (
        <>
          <div className="quiz-session">
            <p>Signed in as <strong>{auth.user.name}</strong></p>
            <button type="button" onClick={signOut}>Sign out</button>
          </div>
          {!canManage ? <p>Your account does not have quiz authoring access.</p> : (
            <>
              <section className="quiz-chooser" aria-label="Choose quiz">
                <div className="quiz-chooser-heading">
                  <h2>Draft quizzes</h2>
                  <button type="button" onClick={() => refreshDrafts()}>Refresh list</button>
                  {canAuthor && <button type="button" onClick={() => { setSelected(null); setEditorVersion((value) => value + 1); }}>New quiz</button>}
                </div>
                {drafts.items.length ? <ul>{drafts.items.map((quiz) => (
                  <li key={quiz.id}><button type="button" onClick={() => { setSelected(quiz); setEditorVersion((value) => value + 1); }}>{quiz.title}</button> <span>({quiz.topic})</span></li>
                ))}</ul> : <p>No drafts on this page.</p>}
                {drafts.total > drafts.limit && <div className="quiz-pagination">
                  <button type="button" disabled={drafts.page <= 1} onClick={() => refreshDrafts(drafts.page - 1)}>Previous</button>
                  <span>Page {drafts.page}</span>
                  <button type="button" disabled={drafts.page * drafts.limit >= drafts.total} onClick={() => refreshDrafts(drafts.page + 1)}>Next</button>
                </div>}
                <form onSubmit={openById} className="quiz-open-id">
                  <label>Open a published quiz by ID <input value={quizId} onChange={(event) => setQuizId(event.target.value)} /></label>
                  <button type="submit" disabled={!quizId.trim()}>Open</button>
                </form>
              </section>
              {(canAuthor || selected) && <QuizEditor
                key={`${editorVersion}-${selected?.id ?? 'new'}`}
                initialQuiz={selected}
                save={(id, payload) => authenticated(() => saveQuiz(id, payload, auth.token))}
                setPublication={(id, publish) => authenticated(() => setQuizPublication(id, publish, auth.token))}
                onSaved={() => refreshDrafts(1)}
                onPublicationChange={() => refreshDrafts(1)}
              />}
            </>
          )}
        </>
      )}
    </main>
  );
}
