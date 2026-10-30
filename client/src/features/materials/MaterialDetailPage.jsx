import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PlainText from '../../components/PlainText';
import { listPublishedQuizzesByTopic } from '../quizzes/quizApi';
import MaterialForm from './MaterialForm';
import MaterialSignIn from './MaterialSignIn';
import { useMaterialSession } from './MaterialSession';
import {
  REPORT_REASONS,
  addComment,
  downloadMaterial,
  materialDownloadName,
  fetchComments,
  fetchRevisions,
  getMaterial,
  rateMaterial,
  reportMaterial,
  updateMaterial,
  validateComment,
  validateRating,
} from './materialApi';
import './materials.css';

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

export default function MaterialDetailPage() {
  const { id } = useParams();
  const { session: auth, signIn, clearSession, logout } = useMaterialSession();
  const [material, setMaterial] = useState(null);
  const [comments, setComments] = useState({ items: [], page: 1, limit: 20, total: 0 });
  const [revisions, setRevisions] = useState([]);
  const [relatedQuizzes, setRelatedQuizzes] = useState({ items: [], page: 1, limit: 20, total: 0 });
  const [relatedError, setRelatedError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(5);
  const [ratingError, setRatingError] = useState('');
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [reason, setReason] = useState('copyright');
  const [reportNote, setReportNote] = useState('');

  const canManage = useMemo(() => Boolean(material && auth
    && (auth.user.role === 'admin' || auth.user.id === material.ownerId)), [material, auth]);

  const handleError = useCallback((error, fallback) => {
    if (error.response?.status === 401) {
      clearSession();
      setNotice('Your session has expired. Sign in again.');
      return;
    }
    const details = error.response?.data?.error?.details;
    setNotice(Array.isArray(details) && details.length ? details[0].message : (error.response?.data?.error?.message || fallback));
  }, [clearSession]);

  const load = useCallback(async (token) => {
    setBusy(true);
    try {
      const [nextMaterial, nextComments, nextRevisions] = await Promise.all([
        getMaterial(id, token),
        fetchComments(id, token, 1),
        fetchRevisions(id, token).catch((error) => {
          if (error.response?.status === 403) return { items: [] };
          throw error;
        }),
      ]);
      setMaterial(nextMaterial);
      setComments(nextComments);
      setRevisions(nextRevisions.items || []);
      setNotice('');
      setRelatedError('');
      try {
        setRelatedQuizzes(await listPublishedQuizzesByTopic(nextMaterial.topic, token));
      } catch {
        setRelatedQuizzes({ items: [], page: 1, limit: 20, total: 0 });
        setRelatedError('Related quizzes could not be loaded.');
      }
    } catch (error) {
      handleError(error, 'Material could not be loaded.');
    } finally {
      setBusy(false);
    }
  }, [id, handleError]);

  async function changeRelatedPage(page) {
    if (!material || !auth) return;
    try {
      setRelatedError('');
      setRelatedQuizzes(await listPublishedQuizzesByTopic(material.topic, auth.token, page));
    } catch {
      setRelatedError('Related quizzes could not be loaded.');
    }
  }

  useEffect(() => {
    if (auth) load(auth.token);
  }, [auth, load]);

  async function signOut() {
    setMaterial(null);
    setNotice('Signed out.');
    await logout();
  }

  async function saveMaterial(payload) {
    const updated = await updateMaterial(id, payload, auth.token);
    setMaterial(updated);
    setEditing(false);
    setNotice('Material updated. The previous details are kept in revision history.');
    const nextRevisions = await fetchRevisions(id, auth.token);
    setRevisions(nextRevisions.items || []);
    setRelatedError('');
    try {
      setRelatedQuizzes(await listPublishedQuizzesByTopic(updated.topic, auth.token));
    } catch {
      setRelatedQuizzes({ items: [], page: 1, limit: 20, total: 0 });
      setRelatedError('Related quizzes could not be loaded.');
    }
    return updated;
  }

  async function download() {
    try {
      const { blob, filename } = await downloadMaterial(id, auth.token);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = materialDownloadName(material.title, filename);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      handleError(error, 'Download failed.');
    }
  }

  async function submitRating(event) {
    event.preventDefault();
    const error = validateRating(Number(rating));
    setRatingError(error || '');
    if (error) return;
    try {
      const result = await rateMaterial(id, Number(rating), auth.token);
      setMaterial((current) => ({ ...current, ratingAvg: result.ratingAvg, ratingCount: result.ratingCount }));
      setNotice('Rating saved.');
    } catch (ratingFailure) {
      handleError(ratingFailure, 'Rating could not be saved.');
    }
  }

  async function submitComment(event) {
    event.preventDefault();
    const error = validateComment(comment);
    setCommentError(error || '');
    if (error) return;
    try {
      await addComment(id, comment.trim(), auth.token);
      setComment('');
      setComments(await fetchComments(id, auth.token, 1));
      setNotice('Comment added.');
    } catch (commentFailure) {
      handleError(commentFailure, 'Comment could not be added.');
    }
  }

  async function submitReport(event) {
    event.preventDefault();
    try {
      await reportMaterial(id, { reason, note: reportNote.trim() }, auth.token);
      setReportNote('');
      setNotice('Report submitted. A moderator will review it.');
      setMaterial(await getMaterial(id, auth.token).catch(() => material));
    } catch (reportFailure) {
      handleError(reportFailure, 'Report could not be submitted.');
    }
  }

  return (
    <main className="materials-page">
      <Link to="/materials">← Study materials</Link>
      {notice && <p role="status">{notice}</p>}
      {!auth ? (
        <MaterialSignIn heading="Sign in to open this material" onSignedIn={(session) => { signIn(session); setNotice(''); }} />
      ) : (
        <>
          <div className="materials-session">
            <p>Signed in as <strong>{auth.user.name}</strong></p>
            <button type="button" onClick={signOut}>Sign out</button>
          </div>
          {busy && <p role="status">Loading material…</p>}
          {material && (
            <>
              <article className="material-detail">
                <h1>{material.title}</h1>
                <p>{material.description}</p>
                <dl>
                  <div><dt>Category</dt><dd>{material.category}</dd></div>
                  <div><dt>Topic</dt><dd>{material.topic}</dd></div>
                  <div><dt>Tags</dt><dd>{material.tags.join(', ')}</dd></div>
                  <div><dt>Visibility</dt><dd>{material.visibility}{material.hidden ? ' (hidden pending review)' : ''}</dd></div>
                  <div><dt>Rating</dt><dd>{material.ratingAvg} from {material.ratingCount} rating(s)</dd></div>
                  <div><dt>Updated</dt><dd>{formatDate(material.updatedAt)}</dd></div>
                </dl>
                <button type="button" onClick={download}>Download file</button>
                {canManage && <button type="button" onClick={() => setEditing((value) => !value)}>{editing ? 'Close editor' : 'Edit material'}</button>}
              </article>

              {editing && canManage && (
                <MaterialForm
                  mode="edit"
                  initialMaterial={material}
                  onSubmit={saveMaterial}
                  submitLabel="Save changes"
                  onCancel={() => setEditing(false)}
                />
              )}

              <section aria-labelledby="related-quizzes-title">
                <h2 id="related-quizzes-title">Quizzes for {material.topic}</h2>
                {relatedError && <p role="alert">{relatedError}</p>}
                {!relatedError && relatedQuizzes.items.length === 0 && <p>No published quizzes for this topic yet.</p>}
                <ul className="material-list">
                  {relatedQuizzes.items.map((quiz) => (
                    <li key={quiz.id}>
                      <h3><Link to={`/quizzes/${quiz.id}/attempt`}>{quiz.title}</Link></h3>
                    </li>
                  ))}
                </ul>
                {relatedQuizzes.total > relatedQuizzes.limit && <div className="material-pagination">
                  <button type="button" disabled={relatedQuizzes.page <= 1} onClick={() => changeRelatedPage(relatedQuizzes.page - 1)}>Previous quizzes</button>
                  <span>Page {relatedQuizzes.page}</span>
                  <button type="button" disabled={relatedQuizzes.page * relatedQuizzes.limit >= relatedQuizzes.total} onClick={() => changeRelatedPage(relatedQuizzes.page + 1)}>Next quizzes</button>
                </div>}
              </section>

              <section aria-labelledby="rating-title">
                <h2 id="rating-title">Rate this material</h2>
                <form className="material-inline-form" onSubmit={submitRating} noValidate>
                  <label>Rating
                    <select value={rating} onChange={(event) => setRating(event.target.value)} aria-invalid={Boolean(ratingError)}>
                      {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <button type="submit">Save rating</button>
                  {ratingError && <span role="alert">{ratingError}</span>}
                </form>
              </section>

              <section aria-labelledby="comments-title">
                <h2 id="comments-title">Comments ({comments.total})</h2>
                <form className="material-comment-form" onSubmit={submitComment} noValidate>
                  <label>Add a comment
                    <textarea rows="3" maxLength="1001" value={comment} onChange={(event) => setComment(event.target.value)} aria-invalid={Boolean(commentError)} />
                  </label>
                  {commentError && <span role="alert">{commentError}</span>}
                  <button type="submit">Post comment</button>
                </form>
                {comments.items.length === 0 ? <p>No comments yet.</p> : (
                  <ul className="material-comments">
                    {comments.items.map((item) => (
                      <li key={item.id}>
                        <p className="material-meta"><strong>{item.author.name || 'User'}</strong> · {formatDate(item.createdAt)}</p>
                        <p><PlainText value={item.content} /></p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="report-title">
                <h2 id="report-title">Report this material</h2>
                <form className="material-report-form" onSubmit={submitReport} noValidate>
                  <label>Reason
                    <select value={reason} onChange={(event) => setReason(event.target.value)}>
                      {REPORT_REASONS.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label>Note (optional)
                    <textarea rows="2" maxLength="1000" value={reportNote} onChange={(event) => setReportNote(event.target.value)} />
                  </label>
                  <button type="submit">Submit report</button>
                </form>
              </section>

              {canManage && (
                <section aria-labelledby="revisions-title">
                  <h2 id="revisions-title">Revision history</h2>
                  {revisions.length === 0 ? <p>No revisions yet.</p> : (
                    <ol className="material-revisions">
                      {revisions.map((revision) => (
                        <li key={revision.id}>
                          <p><strong>Version {revision.versionNo}</strong> · {formatDate(revision.createdAt)}</p>
                          <p>{revision.title} — {revision.description}</p>
                          <p className="material-meta">{revision.category} · {revision.topic} · {(revision.tags || []).join(', ')}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
