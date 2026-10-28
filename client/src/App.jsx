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
      <p className="eyebrow">TEAM 1 · SHARED FOUNDATION</p>
      <h1>Collaborative Study Material &amp; Quiz Platform</h1>
      <p className="intro">The shared React, Express and MongoDB foundation is ready for feature development. This page is a connection check, not a completed product demo.</p>
      <p><Link to="/materials">Browse study materials</Link> · <Link to="/quizzes">Open quiz authoring</Link> · <Link to="/attempt">Sign in and attempt a quiz</Link> · <Link to="/admin/reports">Review reports</Link></p>
      <section className="status-panel" aria-labelledby="status-title">
        <h2 id="status-title">Connection status</h2>
        <p role="status" aria-live="polite">{status === 'checking' ? 'Checking the API and database…' : status === 'ready' ? 'API and MongoDB are connected.' : 'API or database unavailable. Check the setup instructions and local services.'}</p>
        <button type="button" disabled={status === 'checking'} onClick={() => setRetry((value) => value + 1)}>Check again</button>
      </section>
      <section aria-labelledby="next-title">
        <h2 id="next-title">Next: build together</h2>
        <p>Pull the latest main branch, create a task branch, then implement your assigned issue against the SRS, SAD and STP.</p>
        <ul><li>Anisha: accounts and authentication.</li><li>Aryaroop: material and moderation.</li><li>Ayush: quizzes and leaderboard.</li><li>Bharat: attempts, scoring and progress.</li></ul>
      </section>
      <p className="note">Study materials, ratings, comments, reports, moderation review, quiz authoring and student attempts are available.</p>
    </main>
  );
}
