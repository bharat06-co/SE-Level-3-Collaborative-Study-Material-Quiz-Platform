/* global __ENV, __VU */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// The private JSON file must contain 100 distinct student access tokens.
// Never commit it or print its contents in run logs.
const students = new SharedArray('student tokens', () => JSON.parse(open(__ENV.K6_USERS_FILE)));
const baseUrl = __ENV.K6_BASE_URL?.replace(/\/$/, '');
const quizId = __ENV.K6_QUIZ_ID;

if (!baseUrl || !quizId || students.length < 100) {
  throw new Error('Set K6_BASE_URL, K6_QUIZ_ID and K6_USERS_FILE with at least 100 tokens.');
}

const serverErrors = new Rate('server_5xx');

export const options = {
  scenarios: {
    active_students: { executor: 'constant-vus', vus: 100, duration: '10m' },
  },
  thresholds: {
    server_5xx: ['rate==0'],
    checks: ['rate==1'],
  },
};

function record(response) {
  serverErrors.add(response.status >= 500);
  return response;
}

export default function () {
  const student = students[(__VU - 1) % students.length];
  const headers = { Authorization: `Bearer ${student.accessToken}` };

  const page = record(http.get(`${baseUrl}/`, { tags: { flow: 'page' } }));
  check(page, { 'page loads': (response) => response.status === 200 });

  const list = record(http.get(`${baseUrl}/api/v1/quizzes?limit=20`, { headers, tags: { flow: 'browse' } }));
  check(list, { 'quiz browse succeeds': (response) => response.status === 200 && Array.isArray(response.json('items')) });

  const detail = record(http.get(`${baseUrl}/api/v1/quizzes/${quizId}`, { headers, tags: { flow: 'detail' } }));
  check(detail, { 'published quiz detail is safe': (response) => response.status === 200 && !response.body.includes('answerKey') });

  const attempt = record(http.post(`${baseUrl}/api/v1/quizzes/${quizId}/attempts`, JSON.stringify({ answers: [] }), {
    headers: { ...headers, 'Content-Type': 'application/json' }, tags: { flow: 'attempt' },
  }));
  check(attempt, { 'attempt persists and scores': (response) => response.status === 201 &&
    typeof response.json('score') === 'number' && typeof response.json('maxScore') === 'number' });

  sleep(1);
}
