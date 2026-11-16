import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../../api/http';
import MaterialSignIn from '../materials/MaterialSignIn';
import { useMaterialSession } from '../materials/MaterialSession';

const config = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export default function AdminUsersPage() {
  const { session, signIn, clearSession, logout } = useMaterialSession();
  const [expired, setExpired] = useState(false);
  const expireSession = useCallback(() => {
    clearSession();
    setExpired(true);
  }, [clearSession]);

  function handleSignIn(nextSession) {
    setExpired(false);
    signIn(nextSession);
  }
  return (
    <main className="shell">
      <Link to="/">← Home</Link>
      <h1>Manage contributors</h1>
      {session ? (
        <>
          <p>Signed in as {session.user.name} ({session.user.role})</p>
          <button type="button" onClick={logout}>Sign out</button>
          {session.user.role === 'admin' ? (
            <ContributorList key={session.token} token={session.token} clearSession={expireSession} />
          ) : <p role="alert">Administrator access required.</p>}
        </>
      ) : <MaterialSignIn heading="Sign in as administrator" onSignedIn={handleSignIn} />}
      {expired && <p role="alert">Your session has expired. Sign in again.</p>}
    </main>
  );
}

function ContributorList({ token, clearSession }) {
  const request = useRef(null);
  const changing = useRef(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    const { signal } = controller;
    http.get('/admin/users', { ...config(token), signal }).then(({ data }) => {
      if (signal.aborted) return;
      if (!Array.isArray(data.users)) throw new Error('Incomplete user list response.');
      setUsers(data.users);
    }).catch((e) => {
      if (signal.aborted) return;
      if (e.response?.status === 401) return clearSession();
      setError(e.response?.data?.error?.message || 'Could not load users.');
    }).finally(() => {
      if (!signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [token, clearSession]);

  async function changeContributor(user) {
    if (changing.current) return;
    changing.current = true;
    const { signal } = request.current;
    setBusyId(String(user._id));
    setError('');
    setNotice('');
    try {
      const { data } = await http.patch(`/admin/users/${encodeURIComponent(user._id)}/role`,
        { contributor: !user.contributor }, { ...config(token), signal });
      if (signal.aborted) return;
      setUsers((current) => current.map((entry) => entry._id === user._id ? data.user : entry));
      setNotice(`${data.user.name}: contributor ${data.user.contributor ? 'enabled' : 'disabled'}.`);
    } catch (e) {
      if (signal.aborted) return;
      if (e.response?.status === 401) return clearSession();
      setError(e.response?.data?.error?.message || 'Could not change contributor permission.');
    } finally {
      changing.current = false;
      if (!signal.aborted) setBusyId('');
    }
  }

  return (
    <section className="status-panel">
      <h2>Registered accounts</h2>
      {loading && <p role="status">Loading users…</p>}
      {!loading && !error && users.length === 0 && <p>No registered accounts.</p>}
      {users.map((user) => (
        <div key={user._id} style={{ borderBottom: '1px solid #cbd5df', padding: '12px 0' }}>
          <strong>{user.name}</strong> ({user.email}) — {user.role}; contributor: {user.contributor ? 'yes' : 'no'}{' '}
          <button type="button" disabled={Boolean(busyId) || user.role === 'admin'}
            onClick={() => changeContributor(user)}>
            {user.contributor ? 'Revoke contributor' : 'Grant contributor'}
          </button>
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
