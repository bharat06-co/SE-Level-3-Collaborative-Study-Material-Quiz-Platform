import { useEffect, useState } from 'react';
import { getHealth } from './api/http';
import { Link } from 'react-router-dom';
import './styles.css';

export default function App() {
  const [status, setStatus] = useState('checking');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setStatus('checking');
    getHealth({ signal: controller.signal }).then((health) => {
      if (active) setStatus(health.status === 'ok' && health.checks?.database === 'connected' ? 'ready' : 'unavailable');
    }).catch(() => { if (active) setStatus('unavailable'); });
    return () => { active = false; controller.abort(); };
  }, [retry]);
  return (
    <main className="shell">
      <p className="eyebrow">TEAM 1 · SOFTWARE ENGINEERING PROJECT</p>
      <h1>Collaborative Study Material &amp; Quiz Platform</h1>
      <p className="intro">A platform for sharing study materials, creating quizzes, tracking progress and learning together.</p>
      <p>
  <Link to="/register">Register</Link> ·{' '}
  <Link to="/materials">Browse study materials</Link> ·{' '}
  <Link to="/quizzes">Open quiz authoring</Link> ·{' '}
  <Link to="/attempt">Sign in and attempt a quiz</Link> ·{' '}
  <Link to="/leaderboard">View leaderboards</Link> ·{' '}
  <Link to="/admin/reports">Review reports</Link> ·{' '}
  <Link to="/admin/users">Manage contributors</Link> ·{' '}
  <Link to="/profile">My profile</Link> ·{' '}
  <Link to="/forgot-password">Forgot password?</Link>
</p>
      <section className="status-panel" aria-labelledby="status-title">
        <h2 id="status-title">Connection status</h2>
        <p role="status" aria-live="polite">{status === 'checking' ? 'Checking the API and database…' : status === 'ready' ? 'API and MongoDB are connected.' : 'API or database unavailable. Check the setup instructions and local services.'}</p>
        <button type="button" disabled={status === 'checking'} onClick={() => setRetry((value) => value + 1)}>Check again</button>
      </section>
      <p className="note">Study materials, ratings, comments, reports, moderation review, quiz authoring and student attempts are available.</p>
    </main>
  );
}
