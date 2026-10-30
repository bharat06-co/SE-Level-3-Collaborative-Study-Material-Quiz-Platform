'use strict';

// NFR-004 #35A evidence: invalid submissions show field-level inline errors in
// a real Chromium browser against the real React app and disposable API.
// This does NOT replace the human moderated session required by TC-UX-01.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {
  root,
  makeDisposablePassword,
  findFreePort,
  startFixture,
  startVite,
  stopProcess,
} = require('./nfr004-runtime.cjs');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright is not installed. Run: npm install --no-save --package-lock=false playwright@1.56.1 && npx playwright install chromium');
  process.exit(1);
}

const evidenceDir = path.join(root, 'test-results', 'nfr004');
const checks = [];
let fixtureProcess;
let viteProcess;
let browser;

function record(label) {
  checks.push({ label, result: 'PASS' });
  console.log(`PASS: ${label}`);
}

async function visibleText(container, text) {
  const locator = container.getByText(text, { exact: true });
  await locator.waitFor({ state: 'visible', timeout: 15000 });
}

async function heading(page, name, level) {
  await page.getByRole('heading', { name, level }).waitFor({ state: 'visible', timeout: 20000 });
}

async function expectInvalid(container, label, message, { exact = true } = {}) {
  await visibleText(container, message);
  assert.equal(await container.getByLabel(label, { exact }).getAttribute('aria-invalid'), 'true',
    `${label} must expose aria-invalid=true.`);
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: true });
}

async function signIn(page, { email, password, button }) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: button, exact: true }).click();
}

async function main() {
  await fs.mkdir(evidenceDir, { recursive: true });
  const vitePort = await findFreePort();
  const origin = `http://127.0.0.1:${vitePort}`;
  const password = makeDisposablePassword();
  const fixture = await startFixture({ origin, password });
  fixtureProcess = fixture.proc;
  const seed = fixture.seed;
  const vite = await startVite({ apiBaseURL: seed.baseURL, port: vitePort });
  viteProcess = vite.proc;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Material sign-in form.
  await page.goto(`${origin}/materials`, { waitUntil: 'domcontentloaded' });
  await heading(page, 'Sign in to browse materials');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expectInvalid(page, 'Email', 'Email is required.');
  await expectInvalid(page, 'Password', 'Password is required.');
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expectInvalid(page, 'Email', 'Enter a valid email address.');
  await screenshot(page, 'material-signin-inline-validation');
  record('Material sign-in shows field-level required and email-format errors');

  await signIn(page, { email: seed.author.email, password, button: 'Sign in' });
  await heading(page, 'Study materials', 1);
  await heading(page, 'Upload study material', 2);
  await page.getByRole('button', { name: 'Upload material', exact: true }).click();
  const uploadForm = page.getByRole('form', { name: 'Upload material' });
  await expectInvalid(uploadForm, 'Title', 'Title must be 3–120 characters.');
  await expectInvalid(uploadForm, 'Description', 'Description must be 1–2000 characters.');
  await expectInvalid(uploadForm, 'Category', 'Category is required (maximum 100 characters).');
  await expectInvalid(uploadForm, 'Topic', 'Topic is required (maximum 100 characters).');
  await expectInvalid(uploadForm, 'Tags', 'Provide 1–10 tags.');
  await expectInvalid(uploadForm, 'File', 'Choose a file to upload.');
  await visibleText(uploadForm, 'Confirm you have the rights to share this file.');
  await screenshot(page, 'material-upload-inline-validation');
  record('Material upload form shows all inline field errors and does not submit');

  // Material edit form from the real library-to-detail navigation preserves the session.
  await page.getByRole('link', { name: seed.material.title, exact: true }).click();
  await heading(page, seed.material.title, 1);
  await page.getByRole('button', { name: 'Edit material', exact: true }).click();
  await heading(page, 'Edit material details', 2);
  await page.getByLabel('Title').fill('');
  await page.getByLabel('Visibility').selectOption('shared');
  await page.getByLabel('Share with user IDs').fill('bad-id');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  const editForm = page.getByRole('form', { name: 'Edit material' });
  await expectInvalid(editForm, 'Title', 'Title must be 3–120 characters.');
  await expectInvalid(editForm, 'Share with user IDs', 'User IDs must be 24 hexadecimal characters.', { exact: false });
  await screenshot(page, 'material-edit-inline-validation');
  record('Material edit form shows title and shared-user-ID errors inline');

  // Comment form.
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await visibleText(page, 'Comment cannot be empty.');
  assert.equal(await page.getByLabel('Add a comment').getAttribute('aria-invalid'), 'true');
  await screenshot(page, 'material-comment-inline-validation');
  record('Material comment form shows an inline empty-comment error');

  // Material-to-topic-quiz discovery used by the moderated session task.
  await heading(page, `Quizzes for ${seed.material.topic}`, 2);
  const relatedQuiz = page.getByRole('link', { name: seed.quiz.title, exact: true });
  await relatedQuiz.waitFor({ state: 'visible', timeout: 15000 });
  assert.equal(await relatedQuiz.getAttribute('href'), new URL(seed.quiz.url).pathname);
  await screenshot(page, 'material-related-quiz');
  record('Material detail links the published DBMS quiz for its topic');

  // Quiz author sign-in and quiz editor.
  await page.goto(`${origin}/quizzes`, { waitUntil: 'domcontentloaded' });
  await heading(page, 'Quiz authoring', 1);
  await page.getByRole('button', { name: 'Sign in to author quizzes', exact: true }).click();
  await expectInvalid(page, 'Email', 'Email is required.');
  await expectInvalid(page, 'Password', 'Password is required.');
  await signIn(page, { email: seed.author.email, password, button: 'Sign in to author quizzes' });
  await heading(page, 'Draft quizzes', 2);
  await page.getByLabel('Open a published quiz by ID').fill('invalid');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expectInvalid(page, 'Open a published quiz by ID', 'Quiz ID must be 24 hexadecimal characters.');
  await screenshot(page, 'quiz-open-id-inline-validation');
  record('Quiz-author open-by-ID form shows an inline malformed-ID error');

  await page.getByRole('button', { name: 'New quiz', exact: true }).click();
  await heading(page, 'Create quiz', 1);
  await page.getByRole('button', { name: 'Add question', exact: true }).click();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expectInvalid(page, 'Title', 'Title must be 3–120 characters.', { exact: false });
  await expectInvalid(page, 'Topic', 'Topic is required.', { exact: false });
  await visibleText(page, 'Question text is required.');
  await visibleText(page, 'Provide 2–6 nonempty options.');
  await visibleText(page, 'Choose the correct option.');
  await screenshot(page, 'quiz-editor-inline-validation');
  record('Quiz author sign-in and quiz editor show field-level inline errors');

  // Leaderboard quiz/topic query validation.
  await page.goto(`${origin}/leaderboard`, { waitUntil: 'domcontentloaded' });
  await heading(page, 'Leaderboards', 1);
  await signIn(page, { email: seed.participants[1].email, password, button: 'Sign in' });
  await page.getByText(`Signed in as ${seed.participants[1].name}`, { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Show leaderboard', exact: true }).click();
  await visibleText(page, 'Enter a valid 24-character quiz ID.');
  await page.getByLabel('Quiz ID').fill('invalid');
  await page.getByRole('button', { name: 'Show leaderboard', exact: true }).click();
  await visibleText(page, 'Enter a valid 24-character quiz ID.');
  await page.getByRole('button', { name: 'Topic leaderboard', exact: true }).click();
  await page.getByRole('button', { name: 'Show leaderboard', exact: true }).click();
  await visibleText(page, 'Enter a topic of 1–100 characters.');
  await page.getByLabel('Topic').fill('x'.repeat(101));
  await page.getByRole('button', { name: 'Show leaderboard', exact: true }).click();
  await visibleText(page, 'Enter a topic of 1–100 characters.');
  await screenshot(page, 'leaderboard-inline-validation');
  record('Leaderboard form shows inline quiz-ID and topic errors');

  // Student sign-in, quiz-ID entry, and the intentionally optional attempt answers.
  await page.goto(`${origin}/attempt`, { waitUntil: 'domcontentloaded' });
  await heading(page, 'Sign in to attempt a quiz', 1);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expectInvalid(page, 'Email', 'Email is required.');
  await expectInvalid(page, 'Password', 'Password is required.');
  await screenshot(page, 'student-signin-inline-validation');
  await signIn(page, { email: seed.participants[0].email, password, button: 'Sign in' });
  await page.getByText(`Signed in as ${seed.participants[0].name}`, { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Open quiz', exact: true }).click();
  await expectInvalid(page, 'Published quiz ID', 'Quiz ID is required.');
  await page.getByLabel('Published quiz ID').fill('invalid');
  await page.getByRole('button', { name: 'Open quiz', exact: true }).click();
  await expectInvalid(page, 'Published quiz ID', 'Quiz ID must be 24 hexadecimal characters.');
  await screenshot(page, 'student-quiz-id-inline-validation');
  record('Student sign-in and quiz-ID entry show inline validation');

  await page.getByLabel('Published quiz ID').fill(seed.quiz.id);
  await page.getByRole('button', { name: 'Open quiz', exact: true }).click();
  await heading(page, seed.quiz.title, 1);
  await page.getByRole('button', { name: 'Submit attempt', exact: true }).click();
  await heading(page, 'Your results', 2);
  assert.equal(await page.getByRole('alert').count(), 0,
    'Blank answers are valid and must not produce a validation alert.');
  await screenshot(page, 'attempt-blank-answers-valid');
  record('Attempt form treats blank answers as valid and reaches server-scored results');

  await context.close();
}

(async () => {
  let failed = null;
  try {
    await main();
  } catch (error) {
    failed = { message: error.message, stack: error.stack };
    console.error(`FAIL: ${error.stack}`);
  } finally {
    await fs.mkdir(evidenceDir, { recursive: true });
    await fs.writeFile(path.join(evidenceDir, 'inline-validation-results.json'), JSON.stringify({
      timestamp: new Date().toISOString(),
      requirement: 'NFR-004 / TC-UX-01 #35A: every form with a user-reachable invalid state shows inline validation',
      status: failed ? 'FAIL' : 'PASS',
      checks,
      failures: failed ? [failed] : [],
      environment: {
        node: process.version,
        browser: 'Playwright Chromium',
        api: 'actual Express routes + disposable MongoDB replica set',
        frontend: 'actual React via Vite; loopback only',
      },
      limitations: [
        'This is automated inline-validation evidence, not the human moderated five-user session required by #35B.',
        'Forms without a user-reachable invalid state are documented in docs/NFR004_USABILITY.md rather than assigned artificial errors.',
      ],
    }, null, 2));

    if (browser) await browser.close().catch(() => {});
    await stopProcess(viteProcess);
    await stopProcess(fixtureProcess);
  }
  if (failed) process.exitCode = 1;
  else console.log(`NFR-004 inline-validation PASS: ${checks.length} checks; evidence in test-results/nfr004/`);
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
