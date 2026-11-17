import { useEffect, useState } from 'react';
import { getHealth } from './api/http';
import { Link } from 'react-router-dom';
import './styles.css';
import './home.css';

const featureLinks = [
  { to: '/materials', icon: '▤', heading: 'Study materials', description: 'Browse and share learning resources', label: 'Browse study materials' },
  { to: '/quizzes', icon: '✎', heading: 'Quiz authoring', description: 'Create and manage quizzes', label: 'Open quiz authoring' },
  { to: '/attempt', icon: '✓', heading: 'Take a quiz', description: 'Practice and test your knowledge', label: 'Sign in and attempt a quiz' },
  { to: '/leaderboard', icon: '★', heading: 'Leaderboards', description: 'Explore results and rankings', label: 'View leaderboards' },
];

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
    <main className="shell home-page">
      <header className="home-hero">
        <h1>Collaborative Study Material &amp; Quiz Platform</h1>
        <p className="intro">A platform for sharing study materials, creating quizzes, tracking progress and learning together.</p>
        <nav className="home-account-nav" aria-label="Account navigation">
          <Link to="/register">Register</Link>
          <Link to="/profile">My profile</Link>
          <Link to="/forgot-password">Forgot password?</Link>
        </nav>
      </header>

      <section className="home-features" aria-labelledby="home-features-title">
        <div className="home-section-heading">
          <div>
            <p className="home-section-kicker">EXPLORE THE PLATFORM</p>
            <h2 id="home-features-title">What would you like to do?</h2>
          </div>
        </div>
        <div className="home-feature-grid">
          {featureLinks.map(({ to, icon, heading, description, label }) => (
            <Link to={to} className="home-feature-card" key={to} aria-label={label}>
              <span className="home-feature-icon" aria-hidden="true">{icon}</span>
              <span className="home-feature-info">
                <strong>{heading}</strong>
                <span>{description}</span>
              </span>
              <span className="home-feature-arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="home-bottom-grid">
        <section className="home-admin-card" aria-labelledby="home-admin-title">
          <p className="home-section-kicker">ADMINISTRATION</p>
          <h2 id="home-admin-title">Manage the community</h2>
          <p>Review reported content and manage contributor access.</p>
          <div className="home-admin-links">
            <Link to="/admin/reports">Review reports</Link>
            <Link to="/admin/users">Manage contributors</Link>
          </div>
        </section>

        <section className="home-health-card" aria-labelledby="status-title">
          <div className="home-health-heading">
            <div>
              <p className="home-section-kicker">SYSTEM</p>
              <h2 id="status-title">Connection status</h2>
            </div>
            <span className={`home-health-dot home-health-dot--${status}`} aria-hidden="true" />
          </div>
          <p role="status" aria-live="polite">{status === 'checking' ? 'Checking the API and database…' : status === 'ready' ? 'API and MongoDB are connected.' : 'API or database unavailable. Check the setup instructions and local services.'}</p>
          <button type="button" disabled={status === 'checking'} onClick={() => setRetry((value) => value + 1)}>Check again</button>
        </section>
      </div>
      <p className="home-footnote">Study materials, ratings, comments, reports, moderation review, quiz authoring and student attempts are available.</p>
    </main>
  );
}
