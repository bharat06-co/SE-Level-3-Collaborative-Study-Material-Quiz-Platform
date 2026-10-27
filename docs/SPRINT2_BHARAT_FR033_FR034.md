# Sprint 2 — Bharat: FR-033 Attempt history and FR-034 Topic progress

Implementation scope: issues #29 and #30, against the submitted SRS v1.2/SAD v1.0/STP v1.0.

## Endpoints (authenticated student, including contributors)
- `GET /api/v1/attempts/me` → `{ items: [{ id, quizId, quizTitle, topic, score, maxScore, submittedAt }, ...] }` newest first.
- `GET /api/v1/attempts/:id` → same metadata plus immutable stored per-question `answers` for the owner. Another student gets HTTP 403; unknown ID 404; malformed ID 400.
- `GET /api/v1/analytics/me/progress` → `{ topics: [{ topic, quizzesAttempted, averageBestPct }], timeline: [{ attemptId, quizId, quizTitle, topic, score, maxScore, percentage, submittedAt }] }`. Timeline is oldest first. Percentage and average rounded to one decimal place.

The existing `/attempt` React screen now offers **My attempt history** and **My progress** after student login. Opening a detail is deliberate (no answer keys in the history list). Saving a new attempt triggers a refresh of an opened dashboard. Both GET endpoints send `Cache-Control: private, no-store`.

## Data integrity and permissions
- Uses the existing canonical `attempts` schema, `quizzes` collection and production verified JWT/role middleware. No new competing model or changed submission contract.
- Best score is based on stored score/maxScore, not on current answers or editable quiz answer keys.
- Unknown/deleted quiz titles fall back to `Deleted quiz`, with `Unknown topic` for analytics. This is intentional display fallback, not data loss from `attempts`.
- Reads are scoped by verified `studentId`; attempt detail returns 403 if the stored owner differs. Educator/admin attempts history and analytics are refused by the existing student role guard.

## Verification status and closure rule
New tests are included:
- `server/tests/attempt.history.progress.integration.test.js`: real auth, MongoDB-backed history ordering, own detail, 401/403/404, unchanged persisted data after denied reads, stable scores after quiz edits, multi-topic aggregates and empty states.
- `server/tests/progress.service.test.js`: best-score-by-quiz, timeline order, 50.0 rounding, invalid persisted score guard.
- `client/tests/StudentInsights.test.jsx`: history, detail, progress, expiry callbacks.

**Environment limitation of initial implementation:** The assistant's isolated sandbox had Node 22, no installed node_modules, no MongoDB and no network access to install packages. Node syntax validation and pure progress function checks were executed, but the Jest/React integration suites were NOT run here. The latest merged `main` also includes PR #70/#71, which postdate the original Git bundle. The patch modifies only files unchanged by those merges, but must be applied to the latest main and checked there.

Before requesting approval: Node 24/npm 11 → `npm ci` → `npm run check` → `npm run audit:runtime`; review the full diff; verify actual student-browser flows. The separate NFR-007 (#39) requires an API container restart after a 201 and 100 parallel submissions (TC-REL-01). Do **not** close #29 until that dependent durability evidence is accepted. #30 depends on #29 and should not be closed before its integrated history/progress verification passes.

No work in this change fulfills #32/#34/#39/#45 or makes Sprint 2 performance/security claims.
