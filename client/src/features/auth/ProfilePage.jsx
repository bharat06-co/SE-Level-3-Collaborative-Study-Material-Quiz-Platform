import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../../api/http';
import MaterialSignIn from '../materials/MaterialSignIn';
import { useMaterialSession } from '../materials/MaterialSession';
import './profile.css';

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
    <main className="shell profile-page">
      <nav className="profile-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">← Back to home</Link>
        <span aria-hidden="true">/</span>
        <span>Account</span>
      </nav>
      <div className="profile-page-heading">
        <p className="profile-overline">YOUR ACCOUNT</p>
        <h1>My profile</h1>
        <p>View your account details and keep your display name up to date.</p>
      </div>
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

  const initials = (profile?.name || '')
    .trim().split(/\s+/).slice(0, 2)
    .map((part) => part.charAt(0)).join('').toUpperCase() || 'U';

  return (
    <section className="profile-layout" aria-label="Your profile">
      {!profile && !error && <p role="status">Loading profile…</p>}
      {profile && (
        <div className="profile-summary">
          <div className="profile-avatar" aria-hidden="true">{initials}</div>
          <div className="profile-summary-copy">
            <p className="profile-summary-label">ACCOUNT OVERVIEW</p>
            <h2>{profile.name}</h2>
            <p className="profile-summary-email">{profile.email}</p>
          </div>
          <span className="profile-role">{profile.role}</span>
        </div>
      )}
      <div className="profile-card">
        <div className="profile-card-heading">
          <div>
            <h2>Personal information</h2>
            <p>Update the name displayed across your account.</p>
          </div>
        </div>
        <form className="profile-form" onSubmit={save} noValidate>
          <div className="profile-form-field">
            <label htmlFor="profile-name">Display name</label>
            <input id="profile-name" name="name" autoComplete="name" maxLength={60} disabled={!profile || busy}
              value={name} onChange={(event) => setName(event.target.value)} />
            <p className="profile-field-note">This name is visible on your profile.</p>
          </div>
          {profile && (
            <div className="profile-form-field">
              <span className="profile-readonly-label">Email address</span>
              <p className="profile-readonly-value">{profile.email}</p>
            </div>
          )}
          {error && <p className="profile-feedback profile-feedback-error" role="alert">{error}</p>}
          {notice && <p className="profile-feedback profile-feedback-success" role="status">{notice}</p>}
          <div className="profile-actions">
            <button disabled={!profile || busy} type="submit">{busy ? 'Saving…' : 'Save changes'}</button>
            <button className="profile-signout" type="button" onClick={logout}>Sign out</button>
          </div>
        </form>
      </div>
    </section>
  );
}
