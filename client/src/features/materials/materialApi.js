import { http } from '../../api/http';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const TAG_MAX_LENGTH = 30;
const MAX_TAGS = 10;

function authorized(token) {
  if (typeof token !== 'string' || !token) throw new Error('Sign in before accessing materials.');
  return { headers: { Authorization: `Bearer ${token}` } };
}

export function normalizeTags(tags) {
  const values = Array.isArray(tags) ? tags : String(tags || '').split(',');
  return [...new Set(values.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
}

export function validateMaterialFields(fields, { requireFile = false, requireRights = false, file = null } = {}) {
  const errors = {};
  const title = String(fields.title ?? '').trim();
  const description = String(fields.description ?? '').trim();
  const category = String(fields.category ?? '').trim();
  const topic = String(fields.topic ?? '').trim();
  const tags = normalizeTags(fields.tags);

  if (title.length < 3 || title.length > 120) errors.title = 'Title must be 3–120 characters.';
  if (description.length < 1 || description.length > 2000) errors.description = 'Description must be 1–2000 characters.';
  if (category.length < 1 || category.length > 100) errors.category = 'Category is required (maximum 100 characters).';
  if (topic.length < 1 || topic.length > 100) errors.topic = 'Topic is required (maximum 100 characters).';
  if (tags.length < 1 || tags.length > MAX_TAGS) errors.tags = 'Provide 1–10 tags.';
  else if (tags.some((tag) => tag.length > TAG_MAX_LENGTH)) errors.tags = 'Each tag must be at most 30 characters.';

  if (fields.visibility === 'shared') {
    const ids = String(fields.sharedWith ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (!ids.length) errors.sharedWith = 'Add at least one user ID to share with.';
    else if (ids.some((id) => !/^[a-f\d]{24}$/i.test(id))) errors.sharedWith = 'User IDs must be 24 hexadecimal characters.';
  }

  if (requireFile && !file) errors.file = 'Choose a file to upload.';
  if (requireRights && fields.rightsConfirmed !== true) errors.rightsConfirmed = 'Confirm you have the rights to share this file.';
  if (file && file.size > MAX_FILE_BYTES) errors.file = 'The file must be 20 MB or smaller.';

  return errors;
}

export function validateComment(content) {
  const value = String(content ?? '').trim();
  if (value.length < 1) return 'Comment cannot be empty.';
  if (value.length > 1000) return 'Comment must be 1000 characters or fewer.';
  return null;
}

export function validateRating(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5 ? null : 'Choose a rating from 1 to 5.';
}

export async function listMaterials(token, filters = {}) {
  const response = await http.get('/materials', { ...authorized(token), params: filters });
  return response.data;
}

export async function getMaterial(id, token) {
  const response = await http.get(`/materials/${id}`, authorized(token));
  return response.data;
}

function metadataFormData(payload) {
  const form = new FormData();
  for (const field of ['title', 'description', 'category', 'topic', 'visibility']) {
    if (payload[field] !== undefined) form.append(field, payload[field]);
  }
  if (payload.tags !== undefined) form.append('tags', normalizeTags(payload.tags).join(','));
  if (payload.sharedWith !== undefined) {
    const ids = String(payload.sharedWith).split(',').map((id) => id.trim()).filter(Boolean);
    for (const id of ids) form.append('sharedWith', id);
  }
  if (payload.file) form.append('file', payload.file);
  return form;
}

export async function uploadMaterial(payload, token) {
  const form = metadataFormData(payload);
  form.append('rightsConfirmed', 'true');
  const response = await http.post('/materials', form, authorized(token));
  return response.data;
}

export async function updateMaterial(id, payload, token) {
  const hasFile = Boolean(payload.file);
  let body;
  if (hasFile) {
    body = metadataFormData(payload);
  } else {
    body = { ...payload };
    delete body.file;
    if (payload.sharedWith !== undefined) {
      body.sharedWith = String(payload.sharedWith).split(',').map((value) => value.trim()).filter(Boolean);
    }
  }
  const response = await http.patch(`/materials/${id}`, body, authorized(token));
  return response.data;
}

export async function fetchRevisions(id, token) {
  const response = await http.get(`/materials/${id}/revisions`, authorized(token));
  return response.data;
}

export async function rateMaterial(id, value, token) {
  const response = await http.put(`/materials/${id}/rating`, { value }, authorized(token));
  return response.data;
}

export async function fetchComments(id, token, page = 1) {
  const response = await http.get(`/materials/${id}/comments`, { ...authorized(token), params: { page } });
  return response.data;
}

export async function addComment(id, content, token) {
  const response = await http.post(`/materials/${id}/comments`, { content }, authorized(token));
  return response.data;
}

export async function reportMaterial(id, { reason, note }, token) {
  const response = await http.post(`/materials/${id}/reports`, { reason, ...(note ? { note } : {}) }, authorized(token));
  return response.data;
}

export async function fetchReports(token, status = 'open') {
  const response = await http.get('/admin/reports', { ...authorized(token), params: { status } });
  return response.data;
}

export async function decideReport(id, decision, token) {
  const response = await http.patch(`/admin/reports/${id}`, { decision }, authorized(token));
  return response.data;
}

export async function downloadMaterial(id, token) {
  const response = await http.get(`/materials/${id}/file`, { ...authorized(token), responseType: 'blob' });
  return response.data;
}

export const MATERIAL_LIMITS = Object.freeze({ MAX_FILE_BYTES, TAG_MAX_LENGTH, MAX_TAGS });
export const REPORT_REASONS = ['copyright', 'spam', 'inappropriate', 'misleading', 'other'];
