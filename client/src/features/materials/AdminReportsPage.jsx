import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../../api/http';
import PlainText from '../../components/PlainText';
import MaterialSignIn from './MaterialSignIn';
import { decideReport, fetchReports } from './materialApi';
import './materials.css';

export default function AdminReportsPage() {
  const [auth, setAuth] = useState(null);
  const [status, setStatus] = useState('open');
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (token, nextStatus) => {
    setBusy(true);
    try {
      const data = await fetchReports(token, nextStatus);
      setItems(data.items || []);
      setNotice('');
    } catch (error) {
      if (error.response?.status === 401) {
        setAuth(null);
        setNotice('Your session has expired. Sign in again.');
      } else {
        setNotice(error.response?.data?.error?.message || 'Reports could not be loaded.');
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!auth) return;
    if (auth.user.role !== 'admin') {
      setItems([]);
      return;
    }
    load(auth.token, status);
  }, [auth, status, load]);

  async function signOut() {
    setAuth(null);
    setItems([]);
    setNotice('Signed out.');
    try { await http.post('/auth/logout'); } catch { /* Local token is already cleared. */ }
  }

  async function decide(id, decision) {
    setActing(id);
    try {
      await decideReport(id, decision, auth.token);
      await load(auth.token, status);
      setNotice(decision === 'uphold' ? 'Report upheld; the material remains hidden.' : 'Report dismissed.');
    } catch (error) {
      setNotice(error.response?.data?.error?.message || 'The report could not be updated.');
    } finally {
      setActing('');
    }
  }

  return (
    <main className="materials-page">
      <Link to="/">← Home</Link>
      <h1>Moderation reports</h1>
      <p>Review reports against study material. Upholding keeps the material hidden; dismissing restores it when no other open report remains.</p>
      {notice && <p role="status">{notice}</p>}
      {!auth ? (
        <MaterialSignIn heading="Sign in as an administrator" onSignedIn={(session) => { setAuth(session); setNotice(''); }} />
      ) : (
        <>
          <div className="materials-session">
            <p>Signed in as <strong>{auth.user.name}</strong> ({auth.user.role})</p>
            <button type="button" onClick={signOut}>Sign out</button>
          </div>
          {auth.user.role !== 'admin' ? <p>Only administrators can review reports.</p> : (
            <>
              <label>Queue status
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="open">Open</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="actioned">Actioned</option>
                </select>
              </label>
              {busy && <p role="status">Loading reports…</p>}
              {!busy && items.length === 0 && <p>No reports in this queue.</p>}
              <ol className="report-queue">
                {items.map((item) => (
                  <li key={item.id}>
                    <article>
                      <h2>
                        {item.materialTitle || 'Reported material'}
                        {' '}<span className="material-meta">({item.reason})</span>
                      </h2>
                      <p className="material-meta">
                        Reported by {item.reporter?.name || 'User'} · {new Date(item.createdAt).toLocaleString()} · status {item.status}
                      </p>
                      {item.note && <p>Note: <PlainText value={item.note} /></p>}
                      {item.status === 'open' && (
                        <div className="report-actions">
                          <button type="button" disabled={acting === item.id} onClick={() => decide(item.id, 'dismiss')}>Dismiss</button>
                          <button type="button" disabled={acting === item.id} onClick={() => decide(item.id, 'uphold')}>Uphold</button>
                        </div>
                      )}
                      {item.decidedAt && <p className="material-meta">Decided {new Date(item.decidedAt).toLocaleString()}</p>}
                    </article>
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </main>
  );
}
