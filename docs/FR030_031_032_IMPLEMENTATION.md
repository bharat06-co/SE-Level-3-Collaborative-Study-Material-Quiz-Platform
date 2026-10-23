# Bharat — combined FR-030, FR-031 and FR-032 implementation

## Scope and acceptance

Base: main `aedb6322e43002fd8a6d94083692f07e4f7f70fe`. Feature branch: `feat/fr030-submit-attempts`. Related GitHub issues: #26, #27, #28.

- FR-030: student/contributor submission of a published quiz, retake enforcement, role restrictions, validation and acknowledged persistence.
- FR-031: pure O(n) server scorer; 1 correct, 0 wrong/blank; client scores ignored; unknown/duplicate IDs or invalid responses rejected.
- FR-032: accessible MCQ/true-false attempt UI, immediate server score/percentage and one feedback entry per question, correct answer text, no page reload.
- Store attempts now. FR-033 history and FR-034 dashboard remain Sprint 2; SEC-004 across other modules remains separate.

Source checked: combined submitted SRS/SAD/STP, FR-030–032, SAD §4.1.1 and §4.3.4, TC-ATT-01–07/09. Original PDFs are untouched.

## Real application behavior

`POST /api/v1/quizzes/:quizId/attempts` uses central errors, student-only guards and server-owned identity. Valid payload `{answers:[{questionId,response}]}`. Null/missing means unanswered; numeric 0/Boolean false are real responses. Never trust client score, role, studentId or result fields.

Published quiz lookup and scoring occur on the server. Actual saved ID/time and complete results are returned only after a successful write, with Cache-Control no-store. Database/index failures cannot produce false success. No answer key is obtained through a public quiz endpoint by this code.

UI route `/quizzes/:quizId/attempt` uses the public quiz GET then POST, the existing shared Axios client and existing BrowserRouter. Inputs are disabled while pending; a synchronous lock guards duplicate submit events. It handles loading, validation/auth/role/availability/no-retake/network errors. A different quiz resets the session and aborts/ignores obsolete responses. The UI does not persist tokens/results in browser storage. A lost response may follow a successful save, so no automatic POST retry is performed.

Results show correct/incorrect/unanswered in text, not color alone, and convert MCQ answer indices to option labels. Retakes reload the quiz; no-retake results do not offer a retry. Refreshable history is not part of FR-032.

## Auth/quiz integration completed locally

Production startup uses `createAuthenticatedFeatures()` to supply the same shared `createAuthenticate()` middleware to quiz and attempt routes, with `createQuizService().getQuizForScoring` as the private scoring lookup. No identity injection or competing Quiz model is used in startup.

`/attempt` and `/quizzes/:quizId/attempt` require real student login. Tokens stay in memory and are sent explicitly on quiz reads and submissions. Logout clears the local session; 401 requires sign-in again. The feature-specific entry point is temporary until shared client navigation/auth arrives.

Current verification is recorded in `docs/FR030_AUTH_INTEGRATION_VERIFICATION.md`. The preparation results below are retained as historical evidence, not current deployment claims. Remote CI, peer review, Docker/staging and final merged-app verification remain pending.

## Executed evidence for this preparation snapshot

Node 24.14.1, npm 11.11.0. No dependency/runtime changes.

| Check | Result |
|---|---|
| npm ci | Passed |
| npm run check | Lint passed; 80 server + 48 client tests passed; Vite production build passed |
| Included server line coverage | 98.44% |
| Included client line coverage | 100% |
| npm run audit:runtime | 0 vulnerabilities reported |
| Real MongoDB 7.0.14 | Races, persistence, retakes, no-write failures, historical stability and fresh-connection read passed |
| Real Chromium | Published quiz → answer → POST → 2/3 and per-question feedback without navigation; database record verified; blank retake 0/3 passed |
| 390px mobile result layout | No horizontal overflow; rendered screenshot inspected |
| Browser page errors | None in the exercised flow |

Browser integration used Ayush core commit e649c02fb3f2fbb503cb6cc6f09b55fe18816d13, his actual quiz model/service/public projection and private scoring lookup, plus a separate isolated test database. Student context was injected only inside the external test harness. This proves the exercised quiz/attempt/UI contract, NOT a real login/JWT session, deployed environment or full authoring UI. No harness route or fixture auth is present in normal startup.

The MongoDB script tested six simultaneous no-retake submissions across two separate app/repository instances: one 201, five 409, exactly one record. Retakes, later disabling retakes, invalid/draft no-writes, role denial and default 401 also passed. Historical score/correct answer survived a quiz key edit. Fresh-connection readability is not a container restart availability test.

Coverage excludes the existing bootstrap/config exclusions; it is not SonarQube quality-gate evidence. Docker, remote Actions for this not-yet-pushed branch, real JWT integration, load and branded cross-browser testing were not run. Existing development dependency advisories are not represented as clean.

## Repeat locally on Windows

From the repository root on the feature branch, with Node 24/npm 11:

```cmd
npm ci
npm run check
set ATTEMPT_TEST_MONGODB_URI=mongodb://127.0.0.1:27017
node scripts/check-attempt-mongo.cjs
set ATTEMPT_TEST_MONGODB_URI=
```

Use local/development MongoDB only. The script forces a random test database and drops only that database in cleanup. It does not seed the application DB or provide public fake authentication. The standard CI does not automatically run this optional MongoDB script.

## One combined PR

Title: `feat(attempts): submit, score and display quiz feedback (FR-030–032)`

Use `Related to #26, #27, #28` until final peer review, remote CI and merge are complete. Do not automatically close the issues or mark the integrated flow Done based only on isolated tests. Include actual local outputs and pending integration in the PR body; inspect the new GitHub Actions result after pushing.
