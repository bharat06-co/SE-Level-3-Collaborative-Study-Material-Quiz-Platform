import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MaterialForm from './MaterialForm';
import MaterialSignIn from './MaterialSignIn';
import { listMaterials, uploadMaterial } from './materialApi';
import { useMaterialSession } from './MaterialSession';
import './materials.css';

const emptyFilters = { q: '', tag: '', category: '', topic: '' };

export default function MaterialLibraryPage() {
  const { session: auth, signIn, clearSession, logout } = useMaterialSession();
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], page: 1, limit: 20, total: 0 });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async (token, nextPage, nextFilters) => {
    setBusy(true);
    try {
      const data = await listMaterials(token, { ...nextFilters, page: nextPage });
      setResult(data);
      setNotice('');
    } catch (error) {
      if (error.response?.status === 401) {
        clearSession();
        setNotice('Your session has expired. Sign in again.');
      } else {
        setNotice(error.response?.data?.error?.message || 'Materials could not be loaded.');
      }
    } finally {
      setBusy(false);
    }
  }, [clearSession]);

  useEffect(() => {
    if (!auth) return;
    load(auth.token, page, applied);
  }, [auth, page, applied, load]);

  async function signOut() {
    setResult({ items: [], page: 1, limit: 20, total: 0 });
    setNotice('Signed out.');
    await logout();
  }

  function applyFilters(event) {
    event.preventDefault();
    setPage(1);
    setApplied({ ...filters });
  }

  function resetFilters() {
    setFilters(emptyFilters);
    setApplied(emptyFilters);
    setPage(1);
  }

  async function handleUpload(payload) {
    const created = await uploadMaterial(payload, auth.token);
    await load(auth.token, 1, applied);
    setPage(1);
    return created;
  }

  const canAuthor = auth && auth.user.role !== 'admin'
    && (auth.user.role === 'educator' || auth.user.contributor === true);

  return (
    <main className="materials-page">
      <Link to="/">← Home</Link>
      <header>
        <h1>Study materials</h1>
        <p>Search shared notes, upload your own material, and open an item to rate, comment or report it.</p>
      </header>
      {notice && <p role="status">{notice}</p>}
      {!auth ? (
        <MaterialSignIn heading="Sign in to browse materials" onSignedIn={(session) => { signIn(session); setNotice(''); }} />
      ) : (
        <>
          <div className="materials-session">
            <p>Signed in as <strong>{auth.user.name}</strong> ({auth.user.role})</p>
            <button type="button" onClick={signOut}>Sign out</button>
          </div>
          <form className="material-filters" onSubmit={applyFilters}>
            <label>Search
              <input value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} />
            </label>
            <label>Tag
              <input value={filters.tag} onChange={(event) => setFilters((current) => ({ ...current, tag: event.target.value }))} />
            </label>
            <label>Category
              <input value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))} />
            </label>
            <label>Topic
              <input value={filters.topic} onChange={(event) => setFilters((current) => ({ ...current, topic: event.target.value }))} />
            </label>
            <div className="material-filters-actions">
              <button type="submit" disabled={busy}>Apply filters</button>
              <button type="button" onClick={resetFilters}>Reset</button>
            </div>
          </form>

          <section aria-labelledby="material-list-title">
            <h2 id="material-list-title">Results</h2>
            {busy && <p role="status">Loading materials…</p>}
            {!busy && result.items.length === 0 && <p>No materials match these filters.</p>}
            <ul className="material-list">
              {result.items.map((material) => (
                <li key={material.id}>
                  <article>
                    <h3><Link to={`/materials/${material.id}`}>{material.title}</Link></h3>
                    <p>{material.description}</p>
                    <p className="material-meta">
                      <span>{material.category}</span> · <span>{material.topic}</span>
                      {' '}· Rating {material.ratingAvg ?? 0} ({material.ratingCount ?? 0})
                      {' '}· {material.visibility}
                      {material.ownerId === auth.user.id && material.hidden ? ' · hidden pending review' : ''}
                    </p>
                  </article>
                </li>
              ))}
            </ul>
            {result.total > result.limit && (
              <div className="material-pagination">
                <button type="button" disabled={busy || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
                <span>Page {result.page}</span>
                <button type="button" disabled={busy || page * result.limit >= result.total} onClick={() => setPage((value) => value + 1)}>Next</button>
              </div>
            )}
          </section>

          {canAuthor ? (
            <MaterialForm mode="create" submitLabel="Upload material" onSubmit={handleUpload} />
          ) : (
            <p>Your account can browse materials but not upload them.</p>
          )}
        </>
      )}
    </main>
  );
}
