import { once } from 'node:events';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http } from '../src/api/http';
import AppRoutes from '../src/AppRoutes';

jest.setTimeout(180000);

let serverProcess;
let seed;
let originalBaseURL;
let stderr = '';

function startHarness() {
  return new Promise((resolve, reject) => {
    const script = path.resolve(__dirname, '../../scripts/material-fullstack-server.cjs');
    serverProcess = spawn(process.execPath, [script], {
      cwd: path.resolve(__dirname, '../..'),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    const timer = setTimeout(() => {
      reject(new Error(`Full-stack harness did not start.\n${stderr}`));
    }, 90000);
    serverProcess.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    serverProcess.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      const line = stdout.split('\n').find((entry) => entry.startsWith('MATERIAL_TEST_READY '));
      if (!line) return;
      clearTimeout(timer);
      resolve(JSON.parse(line.slice('MATERIAL_TEST_READY '.length)));
    });
    serverProcess.on('exit', (code) => {
      clearTimeout(timer);
      if (!seed) reject(new Error(`Full-stack harness exited with ${code}.\n${stderr}`));
    });
  });
}

function renderAt(route) {
  return render(<MemoryRouter initialEntries={[route]}><AppRoutes /></MemoryRouter>);
}

async function signIn(user, email) {
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), seed.password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

async function login(email) {
  const response = await http.post('/auth/login', { email, password: seed.password });
  return { Authorization: `Bearer ${response.data.accessToken}` };
}

beforeAll(async () => {
  seed = await startHarness();
  originalBaseURL = http.defaults.baseURL;
  http.defaults.baseURL = seed.baseURL;
});

afterAll(async () => {
  http.defaults.baseURL = originalBaseURL;
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill('SIGTERM');
    await Promise.race([once(serverProcess, 'exit'), new Promise((resolve) => setTimeout(resolve, 15000))]);
  }
});

test('library session continues into detail and persists rating and comment', async () => {
  const material = seed.materials.library;
  const user = userEvent.setup();

  renderAt('/materials');
  await signIn(user, seed.users.student);
  await user.click(await screen.findByRole('link', { name: material.title }));
  expect(await screen.findByRole('heading', { name: material.title })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Sign in to open this material' })).not.toBeInTheDocument();

  await user.selectOptions(screen.getByLabelText('Rating'), '4');
  await user.click(screen.getByRole('button', { name: 'Save rating' }));
  expect(await screen.findByText('Rating saved.')).toBeInTheDocument();

  await user.type(screen.getByLabelText('Add a comment'), 'Useful consensus notes');
  await user.click(screen.getByRole('button', { name: 'Post comment' }));
  expect(await screen.findByText('Useful consensus notes')).toBeInTheDocument();
  expect(await screen.findByText('Comment added.')).toBeInTheDocument();

  const studentAuth = await login(seed.users.student);
  const detail = await http.get(`/materials/${material.id}`, { headers: studentAuth });
  expect(detail.data.ratingAvg).toBe(4);
  expect(detail.data.ratingCount).toBe(1);
  const comments = await http.get(`/materials/${material.id}/comments`, { headers: studentAuth });
  expect(comments.data.items.map((item) => item.content)).toContain('Useful consensus notes');
});

test('owner edit through the UI creates a revision newest first', async () => {
  const material = seed.materials.revision;
  const user = userEvent.setup();

  renderAt(`/materials/${material.id}`);
  await signIn(user, seed.users.owner);
  expect(await screen.findByRole('heading', { name: material.title })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Edit material' }));
  await user.clear(screen.getByLabelText('Title'));
  await user.type(screen.getByLabelText('Title'), 'Updated fullstack revision material');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(await screen.findByText(/previous details are kept/)).toBeInTheDocument();
  expect(await screen.findByText('Version 1')).toBeInTheDocument();

  const ownerAuth = await login(seed.users.owner);
  const revisions = await http.get(`/materials/${material.id}/revisions`, { headers: ownerAuth });
  expect(revisions.data.items).toHaveLength(1);
  expect(revisions.data.items[0]).toMatchObject({ versionNo: 1, title: material.title });
});

test('admin uphold followed by dismiss keeps material hidden through the real API', async () => {
  const material = seed.materials.moderation;
  const firstAuth = await login(seed.users.reporterOne);
  const secondAuth = await login(seed.users.reporterTwo);
  await http.post(`/materials/${material.id}/reports`, { reason: 'copyright', note: 'first report' }, { headers: firstAuth });
  await http.post(`/materials/${material.id}/reports`, { reason: 'spam', note: 'second report' }, { headers: secondAuth });

  const user = userEvent.setup();
  renderAt('/admin/reports');
  await signIn(user, seed.users.admin);
  expect(await screen.findByText('first report')).toBeInTheDocument();

  const firstArticle = screen.getByText('first report').closest('article');
  await user.click(within(firstArticle).getByRole('button', { name: 'Uphold' }));
  expect(await screen.findByText('Report upheld; the material remains hidden.')).toBeInTheDocument();

  const secondArticle = (await screen.findByText('second report')).closest('article');
  await user.click(within(secondArticle).getByRole('button', { name: 'Dismiss' }));
  expect(await screen.findByText('Report dismissed.')).toBeInTheDocument();

  const adminAuth = await login(seed.users.admin);
  const detail = await http.get(`/materials/${material.id}`, { headers: adminAuth });
  expect(detail.data.hidden).toBe(true);
  const actioned = await http.get('/admin/reports?status=actioned', { headers: adminAuth });
  const dismissed = await http.get('/admin/reports?status=dismissed', { headers: adminAuth });
  expect(actioned.data.items.some((item) => item.note === 'first report')).toBe(true);
  expect(dismissed.data.items.some((item) => item.note === 'second report')).toBe(true);
  await waitFor(async () => {
    const missing = await http.get('/admin/reports?status=open', { headers: adminAuth });
    expect(missing.data.items).toHaveLength(0);
  });
});
