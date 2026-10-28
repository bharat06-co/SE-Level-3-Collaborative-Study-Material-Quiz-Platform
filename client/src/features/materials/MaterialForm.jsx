import { useState } from 'react';
import { validateMaterialFields } from './materialApi';

function initialFields(material) {
  return {
    title: material?.title || '',
    description: material?.description || '',
    category: material?.category || '',
    topic: material?.topic || '',
    tags: (material?.tags || []).join(', '),
    visibility: material?.visibility || 'private',
    sharedWith: (material?.sharedWith || []).join(', '),
  };
}

export default function MaterialForm({
  initialMaterial,
  mode = 'create',
  onSubmit,
  submitLabel,
  onCancel,
  onSaved,
}) {
  const isEdit = mode === 'edit';
  const [fields, setFields] = useState(() => initialFields(initialMaterial));
  const [file, setFile] = useState(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function change(field, value) {
    setFields((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    const nextErrors = validateMaterialFields(
      { ...fields, rightsConfirmed },
      { requireFile: !isEdit, requireRights: !isEdit, file },
    );
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage('Fix the highlighted fields before saving.');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        title: fields.title.trim(),
        description: fields.description.trim(),
        category: fields.category.trim(),
        topic: fields.topic.trim(),
        tags: fields.tags,
        visibility: fields.visibility,
        ...(fields.visibility === 'shared' ? { sharedWith: fields.sharedWith } : {}),
        ...(file ? { file } : {}),
      };
      const saved = await onSubmit(payload);
      setMessage(isEdit ? 'Material updated.' : 'Material uploaded.');
      if (!isEdit) {
        setFields(initialFields(null));
        setRightsConfirmed(false);
        setFile(null);
        event.target.reset();
      }
      onSaved?.(saved);
    } catch (error) {
      const details = error.response?.data?.error?.details;
      if (Array.isArray(details) && details.length) {
        setErrors((current) => ({
          ...current,
          ...Object.fromEntries(details.map((detail) => [detail.field, detail.message])),
        }));
      }
      setMessage(error.response?.data?.error?.message || 'Material could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="material-form" onSubmit={submit} noValidate aria-label={isEdit ? 'Edit material' : 'Upload material'} aria-busy={busy}>
      <h2>{isEdit ? 'Edit material details' : 'Upload study material'}</h2>
      <label>Title
        <input aria-label="Title" value={fields.title} onChange={(event) => change('title', event.target.value)} aria-invalid={Boolean(errors.title)} />
        {errors.title && <span role="alert">{errors.title}</span>}
      </label>
      <label>Description
        <textarea aria-label="Description" rows="3" value={fields.description} onChange={(event) => change('description', event.target.value)} aria-invalid={Boolean(errors.description)} />
        {errors.description && <span role="alert">{errors.description}</span>}
      </label>
      <div className="material-form-row">
        <label>Category
          <input aria-label="Category" value={fields.category} onChange={(event) => change('category', event.target.value)} aria-invalid={Boolean(errors.category)} />
          {errors.category && <span role="alert">{errors.category}</span>}
        </label>
        <label>Topic
          <input aria-label="Topic" value={fields.topic} onChange={(event) => change('topic', event.target.value)} aria-invalid={Boolean(errors.topic)} />
          {errors.topic && <span role="alert">{errors.topic}</span>}
        </label>
      </div>
      <label>Tags (comma separated, up to 10)
        <input aria-label="Tags" value={fields.tags} onChange={(event) => change('tags', event.target.value)} aria-invalid={Boolean(errors.tags)} />
        {errors.tags && <span role="alert">{errors.tags}</span>}
      </label>
      <label>Visibility
        <select aria-label="Visibility" value={fields.visibility} onChange={(event) => change('visibility', event.target.value)}>
          <option value="private">Private</option>
          <option value="shared">Shared</option>
          <option value="public">Public</option>
        </select>
      </label>
      {fields.visibility === 'shared' && (
        <label>Share with user IDs (comma separated)
          <input aria-label="Share with user IDs" value={fields.sharedWith} onChange={(event) => change('sharedWith', event.target.value)} aria-invalid={Boolean(errors.sharedWith)} />
          {errors.sharedWith && <span role="alert">{errors.sharedWith}</span>}
        </label>
      )}
      <label>{isEdit ? 'Replace file (optional)' : 'File (PDF, DOCX, or PPTX)'}
        <input aria-label="File" type="file" onChange={(event) => { setFile(event.target.files?.[0] || null); setErrors((current) => { const next = { ...current }; delete next.file; return next; }); }} aria-invalid={Boolean(errors.file)} />
        {errors.file && <span role="alert">{errors.file}</span>}
      </label>
      {!isEdit && (
        <label className="material-check">
          <input aria-label="I have the rights to share this file." type="checkbox" checked={rightsConfirmed} onChange={(event) => { setRightsConfirmed(event.target.checked); setErrors((current) => { const next = { ...current }; delete next.rightsConfirmed; return next; }); }} aria-invalid={Boolean(errors.rightsConfirmed)} />
          I have the rights to share this file.
        </label>
      )}
      {errors.rightsConfirmed && <span role="alert">{errors.rightsConfirmed}</span>}
      <div className="material-form-actions">
        <button type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel || (isEdit ? 'Save changes' : 'Upload')}</button>
        {isEdit && onCancel && <button type="button" disabled={busy} onClick={() => onCancel?.()}>Cancel</button>}
      </div>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
