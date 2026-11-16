import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../../api/http';
import MaterialSignIn from '../materials/MaterialSignIn';
import { useMaterialSession } from '../materials/MaterialSession';

const config = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export default function ProfilePage() {
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
    <main className="shell auth-shell">
      <Link to="/">← Home</Link>
      <h1>My profile</h1>
      {session ? (
        <ProfileForm key={session.token} token={session.token} clearSession={expireSession} logout={logout} />
      ) : <MaterialSignIn heading="Sign in to edit your profile" onSignedIn={handleSignIn} />}
      {expired && <p role="alert">Your session has expired. Sign in again.</p>}
    </main>
  );
}

function ProfileForm({ token, clearSession, logout }) {
  const activeRequest = useRef(null);
  const saving = useRef(false);
  const [name, setName] = useState('');
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    activeRequest.current = controller;
    http.get('/users/me', { ...config(token), signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) { setProfile(data.user); setName(data.user.name || ''); }
    }).catch((e) => {
      if (!controller.signal.aborted) {
        if (e.response?.status === 401) return clearSession();
        setError(e.response?.data?.error?.message || 'Could not load your profile.');
      }
    });
    return () => controller.abort();
  }, [token, clearSession]);

  async function save(event) {
    event.preventDefault();
    if (!profile || saving.current) return;
    const signal = activeRequest.current.signal;
    setError('');
    setNotice('');
    if (name.trim().length < 2 || name.trim().length > 60) {
      setError('Name must be between 2 and 60 characters.');
      return;
    }
    saving.current = true;
    setBusy(true);
    try {
      const { data } = await http.patch('/users/me', { name: name.trim() }, { ...config(token), signal });
      if (signal.aborted) return;
      setProfile(data.user);
      setName(data.user.name);
      setNotice('Profile updated.');
    } catch (e) {
      if (signal.aborted) return;
      if (e.response?.status === 401) return clearSession();
      setError(e.response?.data?.error?.message || 'Profile update failed.');
    } finally {
      saving.current = false;
      if (!signal.aborted) setBusy(false);
    }
  }

  return (
    <section className="auth-panel">
      {!profile && !error && <p role="status">Loading profile…</p>}
      {profile && <p>Signed in as {profile.name} · {profile.email} · {profile.role}</p>}
      <form onSubmit={save} noValidate>
        <label htmlFor="profile-name">Display name</label>
        <input id="profile-name" name="name" autoComplete="name" maxLength={60} disabled={!profile || busy}
          value={name} onChange={(event) => setName(event.target.value)} />
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <button disabled={!profile || busy} type="submit">{busy ? 'Saving…' : 'Save changes'}</button>
      </form>
      <button type="button" onClick={logout}>Sign out</button>
    </section>
  );
}
