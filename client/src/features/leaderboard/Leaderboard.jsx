import { useEffect, useRef, useState } from 'react';
import { loadLeaderboard, loadPublishedQuizzes } from './api';
import './leaderboard.css';

export default function Leaderboard({ fetchRanking = loadLeaderboard, fetchQuizzes = loadPublishedQuizzes }) {
  const [mode, setMode] = useState('quiz');
  const [quizzes, setQuizzes] = useState([]);
  const [quizId, setQuizId] = useState('');
  const [topic, setTopic] = useState('');
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hasResult, setHasResult] = useState(false);
  const requestId = useRef(0);

  useEffect(() => () => { requestId.current += 1; }, []);

  function invalidate() {
    requestId.current += 1;
    setItems([]);
    setHasResult(false);
    setError('');
    setBusy(false);
  }

  useEffect(() => {
    let active = true;
    fetchQuizzes().then((list) => { if (active) setQuizzes(list); }).catch(() => {
      if (active) setError('Published quizzes could not be loaded.');
    });
    return () => { active = false; };
  }, [fetchQuizzes]);

  async function showRanking(event) {
    event.preventDefault();
    const currentRequest = ++requestId.current;
    setError('');
    setBusy(true);
    try {
      const result = await fetchRanking(mode === 'quiz' ? { quizId } : { topic: topic.trim() });
      if (currentRequest === requestId.current) {
        setItems(result.items);
        setHasResult(true);
      }
    } catch {
      if (currentRequest === requestId.current) {
        setError('The leaderboard could not be loaded. Please try again.');
        setHasResult(false);
      }
    } finally {
      if (currentRequest === requestId.current) setBusy(false);
    }
  }

  function chooseMode(nextMode) {
    setMode(nextMode);
    invalidate();
  }

  return (
    <section className="leaderboard" aria-labelledby="leaderboard-title">
      <h1 id="leaderboard-title">Leaderboard</h1>
      <p>Compare each student’s best quiz score or total best percentages in a topic.</p>
      <div className="leaderboard-modes" role="group" aria-label="Leaderboard type">
        <button type="button" aria-pressed={mode === 'quiz'} onClick={() => chooseMode('quiz')}>Quiz</button>
        <button type="button" aria-pressed={mode === 'topic'} onClick={() => chooseMode('topic')}>Topic</button>
      </div>
      <form onSubmit={showRanking}>
        {mode === 'quiz' ? (
          <label htmlFor="leaderboard-quiz">Choose a quiz
            <select id="leaderboard-quiz" value={quizId} onChange={(event) => { setQuizId(event.target.value); invalidate(); }} required>
              <option value="">Select a published quiz</option>
              {quizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}
            </select>
          </label>
        ) : (
          <label htmlFor="leaderboard-topic">Topic
            <input id="leaderboard-topic" value={topic} onChange={(event) => { setTopic(event.target.value); invalidate(); }} required />
          </label>
        )}
        <button type="submit" disabled={busy}>{busy ? 'Loading…' : 'Show rankings'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {hasResult && (items.length ? (
        <table><caption>{mode === 'quiz' ? 'Best quiz scores' : 'Sum of best quiz percentages'}</caption>
          <thead><tr><th scope="col">Rank</th><th scope="col">Student</th><th scope="col">Score</th></tr></thead>
          <tbody>{items.map((row) => <tr key={row.studentId}><td>{row.rank}</td><td>{row.name}</td><td>{row.score}</td></tr>)}</tbody>
        </table>
      ) : <p>No attempts yet for this selection.</p>)}
    </section>
  );
}
