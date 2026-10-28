/* global __ENV, __VU */
// NFR-001: 100 constant active HTTP clients for 10 min: 50 full-asset page fetchers
// and 50 authenticated POST submission clients. This is HTTP-level page evidence,
// NOT browser-render/JS-execution timing. Use only isolated compose.acceptance.yaml.
import http from 'k6/http';
import { sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const api = __ENV.NFR_API_URL;
const web = __ENV.NFR_WEB_URL;
const quizId = __ENV.NFR_QUIZ_ID;
const pageMs = new Trend('page_load_ms', true);
const pagePassed = new Rate('page_success');
const submitPassed = new Rate('submission_success');
export const options = {
  scenarios: {
    page_clients: { executor: 'constant-vus', vus: 50, duration: '10m', exec: 'page', gracefulStop: '20s' },
    scoring_clients: { executor: 'constant-vus', vus: 50, duration: '10m', exec: 'submit', gracefulStop: '20s' },
  },
  thresholds: {
    page_load_ms: ['p(95)<=3000'],
    page_success: ['rate>=0.95'],
    'http_req_duration{kind:submission}': ['p(95)<=2000'],
    submission_success: ['rate>=0.99'],
  },
};

export function setup() {
  if (api !== 'http://web' || web !== 'http://web' || !/^[a-f0-9]{24}$/.test(quizId || '')) {
    throw new Error('Use the isolated acceptance Compose network and NFR_QUIZ_ID from NFR-007.');
  }
  const doc = http.get(`${web}/`);
  if (doc.status !== 200) throw new Error('Cannot retrieve test site HTML');
  const pattern = /(?:src|href)="(\/assets\/[^"?#]+)"/g;
  const paths = [];
  let match;
  while ((match = pattern.exec(doc.body)) !== null) paths.push(match[1]);
  const assets = [...new Set(paths)];
  if (assets.length === 0) throw new Error('No production assets found in the generated HTML; test must include JS/CSS');
  const stamp = `${Date.now()}`;
  const password = 'NfrPerformance2026!'; // only on a disposable MongoDB volume
  const tokens = [];
  for (let i = 0; i < 100; i += 1) {
    const email = `load-${stamp}-${i}@example.test`;
    const registration = http.post(`${api}/api/v1/auth/register`, JSON.stringify({ name: 'NFR Load Student', email, password }),
      { headers: { 'Content-Type': 'application/json' } });
    if (registration.status !== 201) throw new Error(`Cannot create test student ${i}: ${registration.status}`);
    const login = http.post(`${api}/api/v1/auth/login`, JSON.stringify({ email, password }),
      { headers: { 'Content-Type': 'application/json' } });
    if (login.status !== 200 || !login.json('accessToken')) throw new Error(`Cannot authenticate test student ${i}`);
    tokens.push(login.json('accessToken'));
  }
  return { assets, tokens, questionId: null };
}

export function page(data) {
  const start = Date.now();
  const index = http.get(`${web}/`, { tags: { kind: 'page-html' } });
  const assets = http.batch(data.assets.map((path) => `${web}${path}`));
  const success = index.status === 200 && assets.every((r) => r.status === 200);
  pagePassed.add(success);
  // Count failures as slow instead of hiding them from the latency percentile.
  pageMs.add(success ? Date.now() - start : 10000);
  sleep(1);
}

export function submit(data) {
  const index = (__VU - 1) % data.tokens.length;
  // Empty answers is a valid submission (all quiz questions unanswered).
  // It still executes validation, authoritative scoring and a durable DB insert.
  const response = http.post(`${api}/api/v1/quizzes/${quizId}/attempts`, JSON.stringify({ answers: [] }), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.tokens[index]}` },
    tags: { kind: 'submission' },
    timeout: '10s',
  });
  submitPassed.add(response.status === 201 && Boolean(response.json('attemptId')));
  sleep(2);
}
