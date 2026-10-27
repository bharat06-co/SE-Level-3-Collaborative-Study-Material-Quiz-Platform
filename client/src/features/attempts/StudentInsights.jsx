import { useEffect, useState } from 'react';
import { fetchAttemptHistory, fetchOwnAttempt, fetchStudentProgress } from './attemptApi';

function displayDate(value) { return new Date(value).toLocaleString(); }

export default function StudentInsights({ token, refreshKey = 0, onUnauthorized }) {
  const [view, setView] = useState('');
  const [data, setData] = useState(null);
  const [detail, setDetail] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!view) return undefined;
    const controller = new AbortController();
    let active = true;
    setPending(true); setError(''); setDetail(null); setData(null);
    const operation = view === 'history' ? fetchAttemptHistory : fetchStudentProgress;
    operation({ token, signal: controller.signal }).then(value => {
      if (active) setData(value);
    }).catch(err => {
      if (!active) return;
      if (err.response?.status === 401) onUnauthorized?.();
      else setError('Could not load your data. Please try again.');
    }).finally(() => { if (active) setPending(false); });
    return () => { active = false; controller.abort(); };
  }, [view, token, refreshKey, onUnauthorized]);

  async function openDetail(attemptId) {
    setError(''); setDetail(null);
    try {
      const result = await fetchOwnAttempt(attemptId, { token });
      setDetail(result);
    } catch (err) {
      if (err.response?.status === 401) onUnauthorized?.();
      else setError(err.response?.status === 403 ? 'This attempt belongs to another student.' : 'Unable to load attempt details.');
    }
  }

  return <section aria-label="Student history and progress" className="attempt-insights">
    <h2>Your learning record</h2>
    <div className="attempt-insights-nav">
      <button type="button" aria-pressed={view === 'history'} onClick={() => setView('history')}>My attempt history</button>
      <button type="button" aria-pressed={view === 'progress'} onClick={() => setView('progress')}>My progress</button>
    </div>
    {pending && <p role="status">Loading your {view === 'history' ? 'attempt history' : 'progress'}…</p>}
    {error && <p role="alert">{error}</p>}
    {view === 'history' && data && <section aria-label="My attempt history">
      <h3>Attempt history</h3>
      {!data.items.length ? <p>No attempts yet.</p> : <ol className="attempt-history-list">
        {data.items.map(item => <li key={item.id}>
          <strong>{item.quizTitle}</strong> — {item.score}/{item.maxScore} · {displayDate(item.submittedAt)}
          <button type="button" onClick={() => openDetail(item.id)}>View attempt</button>
        </li>)}
      </ol>}
      {detail && <section aria-label="Attempt details" className="attempt-feedback">
        <h4>{detail.quizTitle}: {detail.score}/{detail.maxScore}</h4>
        <p>Submitted {displayDate(detail.submittedAt)}</p>
        <ol>{detail.answers.map(answer => <li key={answer.questionId}>
          Question {answer.questionId}: {answer.unanswered ? 'Unanswered' : answer.isCorrect ? 'Correct' : 'Incorrect'}
        </li>)}</ol>
        <button type="button" onClick={() => setDetail(null)}>Close details</button>
      </section>}
    </section>}
    {view === 'progress' && data && <section aria-label="My progress dashboard">
      <h3>Progress by topic</h3>
      {!data.topics.length ? <p>No attempts yet.</p> : <ul className="attempt-topic-progress">
        {data.topics.map(row => <li key={row.topic}>
          <strong>{row.topic}</strong> — {row.quizzesAttempted} quizzes attempted · Average best score: {row.averageBestPct.toFixed(1)}%
        </li>)}
      </ul>}
      <h3>Attempt timeline</h3>
      <ol className="attempt-history-list">
        {data.timeline.map(row => <li key={row.attemptId}>
          {displayDate(row.submittedAt)} — {row.quizTitle}: {row.percentage.toFixed(1)}%
        </li>)}
      </ol>
    </section>}
  </section>;
}
