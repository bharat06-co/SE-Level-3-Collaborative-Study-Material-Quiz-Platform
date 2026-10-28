/* global __ENV, __VU */
// TC-PERF-01 / STP v1.0: 100 simultaneous VUs for 10 minutes, mixing
// production HTML + bundled assets, accessible material browse, MongoDB
// full-text search, and authenticated quiz-attempt writes.
// HTTP-level page timing is NOT browser paint/render timing.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const api = __ENV.NFR_API_URL;
const web = __ENV.NFR_WEB_URL;
const quizId = __ENV.NFR_QUIZ_ID;
const pageMs = new Trend('page_load_ms', true);
const pageSuccess = new Rate('page_success');
const browseSuccess = new Rate('browse_success');
const searchSuccess = new Rate('search_success');
const submissionSuccess = new Rate('submission_success');
const functionalSuccess = new Rate('functional_success');
const serverError = new Rate('http_5xx_rate');

// 25+25+25+25 constant VUs run *simultaneously*, not 100 users in successive phases.
export const options = {
  setupTimeout: '5m',
  scenarios: {
    page_clients: { executor: 'constant-vus', vus: 25, duration: '10m', exec: 'page', gracefulStop: '20s' },
    browse_clients: { executor: 'constant-vus', vus: 25, duration: '10m', exec: 'browse', gracefulStop: '20s' },
    search_clients: { executor: 'constant-vus', vus: 25, duration: '10m', exec: 'search', gracefulStop: '20s' },
    scoring_clients: { executor: 'constant-vus', vus: 25, duration: '10m', exec: 'submit', gracefulStop: '20s' },
  },
  thresholds: {
    page_load_ms: ['p(95)<=3000'],
    'http_req_duration{kind:submission}': ['p(95)<=2000'],
    page_success: ['rate>=0.95'],
    submission_success: ['rate==1'],
    browse_success: ['rate==1'],
    search_success: ['rate==1'],
    functional_success: ['rate==1'],
    http_5xx_rate: ['rate==0'],
    'http_req_failed': ['rate==0'],
    checks: ['rate==1'],
  },
};

function bodyJson(response) {
  try { return response.json(); } catch { return null; }
}
function record(responses, accepted) {
  const list = Array.isArray(responses) ? responses : [responses];
  for (const item of list) serverError.add(item.status >= 500 && item.status <= 599);
  functionalSuccess.add(accepted);
  return accepted;
}
function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}
function userToken(data) {
  return data.tokens[(__VU - 1) % data.tokens.length];
}

export function setup() {
  if (api !== 'http://web' || web !== 'http://web' || !/^[a-f0-9]{24}$/.test(quizId || '')) {
    throw new Error('Run only inside isolated acceptance Compose, after NFR-007 verification.');
  }
  const index = http.get(`${web}/`);
  if (index.status !== 200) throw new Error('Cannot retrieve production HTML');
  const pattern = /(?:src|href)="(\/assets\/[^"?#]+)"/g;
  const paths = [];
  let match;
  while ((match = pattern.exec(index.body)) !== null) paths.push(match[1]);
  const assets = [...new Set(paths)];
  if (assets.length === 0) throw new Error('Built JS/CSS assets were not found');
  const password = 'NfrOnlyDisposablePerformance2026!';
  const stamp = Date.now();
  const tokens = [];
  for (let i = 0; i < 100; i += 1) {
    const email = `stp-load-${stamp}-${i}@example.test`;
    const registered = http.post(`${api}/api/v1/auth/register`, JSON.stringify({ name: 'STP Load Student', email, password }),
      { headers: { 'Content-Type': 'application/json' } });
    if (registered.status !== 201) throw new Error(`Registration ${i}: ${registered.status}`);
    const login = http.post(`${api}/api/v1/auth/login`, JSON.stringify({ email, password }),
      { headers: { 'Content-Type': 'application/json' } });
    const token = bodyJson(login)?.accessToken;
    if (login.status !== 200 || typeof token !== 'string') throw new Error(`Login ${i}: ${login.status}`);
    tokens.push(token);
  }
  const quizResponse = http.get(`${api}/api/v1/quizzes/${quizId}`, { headers: authHeaders(tokens[0]) });
  const quiz = bodyJson(quizResponse);
  if (quizResponse.status !== 200 || !quiz?.questions?.length) throw new Error('Published scoring fixture not accessible');
  const question = quiz.questions[0];
  if (question.type !== 'true_false') throw new Error('Unexpected scoring fixture question type');
  const listResponse = http.get(`${api}/api/v1/materials?limit=20&page=1`, { headers: authHeaders(tokens[0]) });
  const materialPage = bodyJson(listResponse);
  if (listResponse.status !== 200 || materialPage?.total < 40 || !materialPage.items?.[0]?.id) {
    throw new Error('Missing 40 seeded accessible study materials');
  }
  const searchResponse = http.get(`${api}/api/v1/materials?q=database&limit=20&page=1`,
    { headers: authHeaders(tokens[0]) });
  const search = bodyJson(searchResponse);
  if (searchResponse.status !== 200 || search?.total < 24 || !search.items?.length) {
    throw new Error('Missing seeded searchable text index/materials');
  }
  return { assets, tokens, questionId: question.id, materialId: materialPage.items[0].id };
}

export function page(data) {
  const start = Date.now();
  const index = http.get(`${web}/`, { tags: { kind: 'page-html' } });
  const resources = http.batch(data.assets.map((path) => [
    'GET', `${web}${path}`, null, { tags: { kind: 'page-asset' } },
  ]));
  const all = [index, ...resources];
  const pageOk = all.every((response) => response.status === 200);
  pageSuccess.add(pageOk);
  pageMs.add(pageOk ? Date.now() - start : 10000);
  // Also read the authenticated student's history as an application data request.
  const state = http.get(`${api}/api/v1/attempts/me`,
    { headers: authHeaders(userToken(data)), tags: { kind: 'page-data' } });
  const ok = pageOk && state.status === 200 && Array.isArray(bodyJson(state)?.items);
  check(index, { 'page resources and authenticated page data succeed': () => ok });
  record([...all, state], ok);
  sleep(1);
}

export function browse(data) {
  const token = userToken(data);
  const list = http.get(`${api}/api/v1/materials?page=1&limit=20`,
    { headers: authHeaders(token), tags: { kind: 'browse' } });
  const details = http.get(`${api}/api/v1/materials/${data.materialId}`,
    { headers: authHeaders(token), tags: { kind: 'browse' } });
  const listBody = bodyJson(list);
  const item = bodyJson(details);
  const ok = list.status === 200 && details.status === 200 &&
    Array.isArray(listBody?.items) && listBody.items.length > 0 && item?.id === data.materialId;
  check(list, { 'material browsing list and detail both succeed': () => ok });
  browseSuccess.add(ok);
  record([list, details], ok);
  sleep(1);
}

export function search(data) {
  const response = http.get(`${api}/api/v1/materials?q=database&limit=20&page=1`,
    { headers: authHeaders(userToken(data)), tags: { kind: 'search' } });
  const result = bodyJson(response);
  const ok = response.status === 200 && Array.isArray(result?.items) &&
    result.items.length > 0 && result.items.every((item) => item.title.includes('Database'));
  check(response, { 'seeded MongoDB full-text material search succeeds': () => ok });
  searchSuccess.add(ok);
  record(response, ok);
  sleep(1);
}

export function submit(data) {
  const response = http.post(`${api}/api/v1/quizzes/${quizId}/attempts`,
    JSON.stringify({ answers: [{ questionId: data.questionId, response: true }] }), {
      headers: { ...authHeaders(userToken(data)), 'Content-Type': 'application/json' },
      tags: { kind: 'submission' }, timeout: '10s',
    });
  const result = bodyJson(response);
  const ok = response.status === 201 && /^[a-f0-9]{24}$/.test(result?.attemptId || '') &&
    result.score === 1 && result.maxScore === 1;
  check(response, { 'scored submission is acknowledged and correct': () => ok });
  submissionSuccess.add(ok);
  record(response, ok);
  sleep(2);
}
