# SEC-003 role-by-endpoint verification

## Scope and identity
This is a test/documentation-only change on main `80b4da085bf442a0e6fc56c4e7337bae5f2e4964`. No production authorization rules are changed.

New suite: `server/tests/role.permission.matrix.integration.test.js`.
The suite uses actual login-issued JWTs, production `createAuthenticatedFeatures()` wiring, a disposable MongoDB replica set and temporary disk storage. Fixtures create accounts and valid domain data; no injected authentication identities or mocked authorization decisions are used.

Actors: plain student, student contributor, educator owner, another educator and administrator. Quiz mutation cases additionally switch ownership between educator and contributor. Expected behavior follows current agreed business rules, not an assumption that admin can author or every rejection must be 403.

## Current-main protected endpoint matrix
S = plain student; C = student contributor; E = educator; A = admin.

| Operation | Endpoint | Allowed with valid input | Denied / ownership rule | New test name prefix |
|---|---|---|---|---|
| Admin list | GET /api/v1/admin/users | A:200, no password hashes | S/C/E:403 FORBIDDEN | admin.list |
| Admin update | PATCH /api/v1/admin/users/:id/role | A:200, stored contributor flag verified | S/C/E:403; DB/files unchanged | admin.update |
| Quiz create | POST /api/v1/quizzes | C/E:201, correct persisted author | S/A:403; admin moderates but does not author | quiz.create |
| Published quiz list | GET /api/v1/quizzes | S/C/E/A:200; only published items | Draft not leaked; no answer keys | quiz.list and published read |
| Published quiz read | GET /api/v1/quizzes/:id | S/C/E/A:200 | No answer keys | quiz.list and published read |
| Draft quiz list | GET /api/v1/quizzes?status=draft | C/E:own drafts only; A:all drafts,200 | S:403; unrelated author drafts absent | quiz draft list/read |
| Draft quiz read | GET /api/v1/quizzes/:id | Owner/A:200 | Unrelated users:404 NOT_FOUND | quiz draft list/read |
| Quiz edit | PUT /api/v1/quizzes/:id | Authorised C/E owner or A:200; persisted title checked | Other author/plain S:403, entire stored snapshot unchanged | quiz.edit |
| Quiz publish | POST /api/v1/quizzes/:id/publish | Authorised C/E owner or A:200; persisted status published | Other author/plain S:403, snapshot unchanged | quiz.publish |
| Quiz unpublish | POST /api/v1/quizzes/:id/unpublish | Authorised C/E owner or A:200; persisted status draft | Other author/plain S:403, snapshot unchanged | quiz.unpublish |
| Quiz delete | DELETE /api/v1/quizzes/:id | Authorised C/E owner or A:204; persisted record absent | Other author/plain S:403, snapshot unchanged | quiz.delete |
| Submit attempt | POST /api/v1/quizzes/:quizId/attempts | S/C:201; stored studentId verified | E/A:403, no write | attempt.submit |
| Upload material | POST /api/v1/materials | C/E:201; private owner + exact stored file bytes checked | S/A:403, no record/file write | material.upload |
| Material search/list | GET /api/v1/materials | S/C/E/A:200; only visible items returned | Private/unlisted-shared/hidden items absent; no storageKey leak | material.list |
| Material detail | GET /api/v1/materials/:id | Owner/A; public; explicitly shared recipient:200 | Private/unlisted-shared/hidden outsider:404 | material detail/download |
| Material download | GET /api/v1/materials/:id/file | Same access rules:200; exact file bytes checked | Inaccessible:404, no stored changes | material detail/download |
| Material visibility update | PATCH /api/v1/materials/:id | Owner/A:200; persisted visibility/sharedWith checked | Non-owner:403; DB/files unchanged | material.visibility |
| Material visibility alias | PATCH /api/v1/materials/:id/visibility | Same rules:200; persisted visibility/sharedWith checked | Non-owner:403; DB/files unchanged | material.visibility.alias |

There are 16 distinct method/path operations in this PR extension; query/state variants expand the matrix. Every distinct operation is also checked with both missing and invalid tokens. Expected failures are 401 UNAUTHENTICATED and 401 TOKEN_INVALID respectively, with complete domain/user records and file hashes unchanged.

## Database-fresh permissions
The additional lifecycle test verifies with the same JWT: denied plain-student upload; admin grant; allowed upload and quiz create; admin revoke; denied upload and quiz edit with existing records/files unchanged. Demoting an admin in the DB also makes their existing JWT lose admin list/update access immediately.

## Independent execution on PR #70 + this suite
`npm run check`: PASS.
- Backend: 463 tests, 19 suites passed (142 new matrix tests; baseline 321).
- Frontend: 74 tests, 10 suites passed.
- ESLint with zero warnings and production build passed.
- Server coverage: 94.79% statements / 87.94% branches / 97.51% functions / 97.39% lines.

## Existing evidence reused
- admin.test.js: input validation, sanitised responses and role/contributor updates.
- auth.middleware.test.js: signature/expiry and database-fresh identity boundaries.
- quiz.auth.db.integration.test.js: real-login ownership/moderation, regression proof from merged #67.
- attempt.auth.integration.test.js: actual submission/scoring/no-retake/database integration.
- material.auth.integration.test.js and material.routes.test.js: authenticated access, contract errors, multipart handling and file validation.
- New matrix adds explicit cross-role coverage and unchanged DB/file checks; it does not replace feature tests.

## Honest issue acceptance and future endpoints
Issue #43's broad “every disallowed call returns 403” wording must be read as authenticated role denial. Missing/invalid authentication is 401; contractual concealed resources are 404. This report records that distinction; it does not silently edit the issue or original contract.

Current-main implemented endpoint coverage is ready for reviewer acceptance once this test/documentation PR is merged. Future endpoints must ship with their own permission tests. Do not require Anisha to implement unrelated features solely to close this verification increment, and do not claim missing routes have passed tests.

Material metadata edit/delete operations remain outside this implemented matrix and tracked by #47 (with metadata feature #19 and the unresolved delete API contract). Their absence does not become “verified” merely because this suite passes. No whole-system/staging/security-certification claim is made.

## PR #70 material extension
PR #70 adds material search/list and the two visibility-update routes on top of the current-main matrix. This suite now verifies those endpoints across all five actors, including visibility-safe search results, owner/admin updates, non-owner 403 denials, missing/invalid token 401 responses and unchanged database/file snapshots after rejected calls. It does not merge Sprint 2 metadata editing or revision history; those remain future endpoint coverage.
