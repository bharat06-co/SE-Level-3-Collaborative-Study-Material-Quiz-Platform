import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import MaterialSignIn from '../materials/MaterialSignIn';
import { useMaterialSession } from '../materials/MaterialSession';
import { fetchLeaderboard } from './leaderboardApi';
import './leaderboard.css';

const objectId = /^[0-9a-fA-F]{24}$/;

export default function LeaderboardPage() {
  const [searchParams] = useSearchParams();
  const { session, signIn, clearSession, logout } = useMaterialSession();
  const [scope, setScope] = useState(searchParams.has('topic') ? 'topic' : 'quiz');
  const [quizId, setQuizId] = useState(searchParams.get('quizId') || '');
  const [topic, setTopic] = useState(searchParams.get('topic') || '');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load(page = 1) {
    if (!session) return;
    const value = scope === 'quiz' ? quizId.trim() : topic.trim();
    if (scope === 'quiz' && !objectId.test(value)) {
      setError('Enter a valid 24-character quiz ID.');
      return;
    }
    if (scope === 'topic' && (!value || value.length > 100)) {
      setError('Enter a topic of 1–100 characters.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setResult(await fetchLeaderboard({
        ...(scope === 'quiz' ? { quizId: value } : { topic: value }), token: session.token, page,
      }));
    } catch (failure) {
      if (failure.response?.status === 401) {
        clearSession();
        setResult(null);
        setError('Your session has expired. Sign in again.');
      } else {
        setError(failure.response?.data?.error?.message || 'Leaderboard could not be loaded.');
      }
    } finally {
      setBusy(false);
    }
  }

  function changeScope(next) {
    setScope(next);
    setResult(null);
    setError('');
  }

  return <main className="leaderboard-page">
    <Link to="/">← Platform home</Link>
    <h1>Leaderboards</h1>
    {!session ? <MaterialSignIn heading="Sign in to view leaderboards" onSignedIn={signIn} /> : <>
      <p>Signed in as <strong>{session.user.name}</strong> <button type="button" onClick={logout}>Sign out</button></p>
      <div className="leaderboard-tabs" role="group" aria-label="Leaderboard scope">
        <button type="button" aria-pressed={scope === 'quiz'} onClick={() => changeScope('quiz')}>Quiz leaderboard</button>
        <button type="button" aria-pressed={scope === 'topic'} onClick={() => changeScope('topic')}>Topic leaderboard</button>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); load(); }}>
        {scope === 'quiz' ? <label>Quiz ID
          <input value={quizId} onChange={(event) => setQuizId(event.target.value)} />
        </label> : <label>Topic
          <input value={topic} onChange={(event) => setTopic(event.target.value)} />
        </label>}
        <button type="submit" disabled={busy}>Show leaderboard</button>
      </form>
      {busy && <p role="status">Loading leaderboard…</p>}
      {error && <p role="alert">{error}</p>}
      {result && <section aria-label={scope === 'quiz' ? 'Quiz leaderboard results' : 'Topic leaderboard results'}>
        <h2>{scope === 'quiz' ? result.title : result.topic}</h2>
        {!result.items.length ? <p>No attempts yet.</p> : <table>
          <thead><tr><th scope="col">Rank</th><th scope="col">Student</th><th scope="col">{scope === 'quiz' ? 'Best score' : 'Sum of best percentages'}</th></tr></thead>
          <tbody>{result.items.map((row) => <tr key={row.studentId}>
            <td>{row.rank}</td><td>{row.studentName}</td>
            <td>{scope === 'quiz' ? row.score : Number(row.rankingScore.toFixed(2))}</td>
          </tr>)}</tbody>
        </table>}
        {result.total > result.limit && <nav aria-label="Leaderboard pages">
          <button type="button" disabled={busy || result.page <= 1} onClick={() => load(result.page - 1)}>Previous</button>
          <span>Page {result.page}</span>
          <button type="button" disabled={busy || result.page * result.limit >= result.total} onClick={() => load(result.page + 1)}>Next</button>
        </nav>}
      </section>}
    </>}
  </main>;
}
