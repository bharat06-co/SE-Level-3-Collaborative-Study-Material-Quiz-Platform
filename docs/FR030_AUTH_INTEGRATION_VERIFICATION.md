# FR-030–032: shared authentication and quiz integration

## Snapshot

Prepared on PR #57 (`feat/fr030-submit-attempts`) with merged main `59c90d4` (auth #62/#63, validation #58 and quiz core #51). Original submitted PDFs are unchanged.

## Changes

- Resolve main/feature conflicts without dropping registration, login, refresh/logout, quiz routes or their tests.
- Production startup uses `createAuthenticatedFeatures()` to wire the shared JWT middleware and server-only quiz scoring service into attempts.
- Preserve student-only submission, authoritative server scoring, acknowledged persistence and the partial unique no-retake guard.
- Add `/attempt` and authenticated `/quizzes/:quizId/attempt` entry points using real login, memory-only Bearer tokens and the existing Axios instance.
- No fake authentication, public test identity, browser token storage or duplicate Quiz model.
- No automatic POST retry. A 401 clears the feature session and asks for sign-in; this is not a completed shared refresh interceptor.

## Checks executed locally

- `npm ci`: passed.
- `npm run check`: passed; 184 backend tests, 55 frontend tests, lint and frontend production build.
- Backend line coverage: 96.98%; frontend line coverage: 98.05% for the configured included files. These are not SonarQube results.
- New real-MongoDB replica-set tests use production feature configuration and actual registration/login tokens:
  - Educator creates/publishes a quiz; student reads without answer keys.
  - Option index 0 and Boolean false score correctly; blank answers remain unanswered.
  - A forged client score/studentId is ignored; stored identity and score are server-owned.
  - Stored attempts are readable through a fresh connection.
  - Six concurrent no-retake submissions across two app instances produce one 201, five 409s and one record.
  - Invalid authentication, non-student roles, unknown question IDs and unpublished quizzes produce no attempt writes.
  - The same JWT follows current database role changes; student contributors can attempt.
- Local Chromium with actual Express, Vite and isolated MongoDB 8.2.6 replica set:
  - Real student login -> public quiz -> option 0/false submission -> persisted 2/3 result and per-question feedback without navigation.
  - Desktop and 390px mobile results inspected; no horizontal overflow at mobile width.
  - No localStorage/sessionStorage writes; logout clears the UI; reload requires sign-in.
  - No browser page errors in the exercised flow.
- Synthetic educator/student accounts were created only in the isolated test database. Test role setup is not a production admin endpoint or proof that FR-004 is complete.

## Remaining limitations

- Changes are prepared locally; remote PR CI and peer review must run after pushing.
- Docker, shared staging, cross-browser, load and container-restart acceptance were not executed in this increment.
- Shared auth JSON error-code alignment remains Anisha's separate integration fix. Update branches and rerun contract tests after that merges.
- Ayush #54's authoring route is not merged here; coordinate its future `/quizzes` route with this branch's existing AppRoutes rather than replacing one router with another.
- #61 security integration is separate. This increment does not complete all SEC-004 acceptance, history, analytics or all team Sprint 1 work.
- No issue has been closed and no remote PR has been modified by this preparation.
