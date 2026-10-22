# Shared contracts and feature handoff

The original combined Part-1 PDF remains the source of truth. This document makes the starter integration boundary explicit; it does not replace the endpoint catalogue, schemas or business rules. Confirm uncertain items before implementing.

## Fixed external conventions from SAD
- React 18 client; Express 4; MongoDB 7/Mongoose 8. Working runtime: **Node 24 LTS** under owner-authorised DEV-04. The original SAD said Node 20; that historical version is not the current installation target.
- Layered modular monolith: routes → middleware → controller → service → repository. Repository code owns MongoDB operations.
- Prefix `/api/v1`; JSON except multipart material upload.
- Access token in `Authorization: Bearer <accessToken>` except the documented public/refresh-cookie endpoints. Refresh-cookie rotation and cookie policy belong to Anisha's implementation; do not invent persistent browser token storage here.
- Default page=1, limit=20, max=50. List shape `{items, page, limit, total}`.
- MongoDB IDs: 24 hex characters; invalid IDs return 400 through schema validation.
- Central errors: `{error:{code,message,details:[],requestId}}`. Controllers do not assemble ad hoc error shapes.
- Root request ID is generated server-side and returned as `X-Request-ID`.
- No student quiz response may leak answer keys before submission. Use a distinct server-only interface to obtain scoring data.
- Actual quiz question types are `mcq` and `true_false`; MCQ `answerKey`/response is an option index; true/false is a Boolean. Read SAD §4.3.4–4.3.5 for full payloads, invalid/duplicate question behavior and results.
- Attempt scoring is pure and server-side: 1 correct, 0 incorrect/unanswered; ignore client scores. Persist actual results before returning successful submission.
- Visibility/report/retake/ownership rules remain those in the SRS; UI checks never replace server checks.

## What the starter implements
The foundation implements `/api/v1/health`; the FR-030 increment additionally mounts the guarded submission route (see below). Health returns 200 with `{status:"ok",checks:{process:"up",database:"connected"}}` when process and connection state are ready; it does not claim domain readiness. Disconnected DB returns 503 with `SERVICE_UNAVAILABLE` in the central error envelope. This diagnostic code/shape is an explicit working extension because the SAD does not fully define health payloads; the owner has authorised keeping it as a technical clarification; independent PR review remains required (see DEV-03).

`createApp(options)` builds Express with no listening socket or DB connection. `index.js` owns startup/connection/shutdown. Tests can supply an isolated database-state function and register test-only routers; those test endpoints do not exist in the real server.

Feature owners mount routers in `app.js`, before 404/error handlers, using an agreed small PR. **Do not mount a public fake-auth router** to unblock frontend development.

## Proposed internal authentication boundary — confirm in auth PR
Use one request context such as `req.auth = { userId, role, contributor }` after verified authentication. This is an INTERNAL suggestion for team agreement, not a field mandated by the SRS or an implemented property in the starter. Anisha should confirm/document the actual name/shape once, then all owners use it. Never trust a context copied from client JSON.

## Shared responsibilities
- Anisha: auth/user routes, verified context, role/contributor guards, refresh/reset cookies/tokens, auth context/client refresh integration.
- Aryaroop: material/moderation models/services/repositories/routes/pages, file adapter/signature/size checks, authorised download, UI coordination.
- Ayush: quiz model/routes/services, validation, publishing, server-only scoring lookup, leaderboard; coordinate shared Mongoose schemas/indexes as database lead.
- Bharat: attempt model/services/scoring/results/progress, central error/log integration; agree validation conventions with Anisha and all feature owners.
- Every owner: their own pages, route integration, positive/negative/security tests and meaningful PR evidence.

Domain schemas are intentionally not invented in this foundation. Read SAD §3.6.1 for exact collections/fields/indexes. Agree shared definitions before independently generating incompatible schemas. Models must not be duplicated across modules under different collection names.

## Dependency-first work
1. Merge reviewed starter and agree shared middleware/model boundaries.
2. Implement auth guards and core models/interfaces early; mock only in isolated tests until real dependencies merge.
3. Quiz authoring and pure scoring can develop in parallel against SAD data fixtures.
4. Integrate real auth/quizzes/attempt persistence before marking Sprint 1's core flow Done.
5. FR-033 history UI is Sprint 2, but Sprint 1 submission must already save attempts and results. No successful response before the write succeeds.

## Do not accidentally change the rules
- New material defaults private; plain students cannot author until contributor permission is granted.
- Topic-related material quizzes are published-only (FR-024).
- Reports hide material following BR-4 and the full SAD handling of other open reports; don't restore a still-reported item blindly.
- Quiz attempts are by students (including contributors), not educators/admins.
- Competition ranking is 1,1,3; topic ranking sums per-quiz best percentages, not raw scores.
- No new quiz-versioning design: stored attempts retain historical outcomes per D-3.
- Material multipart fields include `rightsConfirmed=true` per BR-5; don't omit copyright confirmation.

## Review before future changes
Original SAD references `TOKEN_EXPIRED` but its error-table completeness needs clarification; don't invent client refresh behavior until auth PR agrees it. SEC-007/STP references material deletion while API catalogue completeness was flagged earlier; review the exact design and log the approved addition if needed. The foundation implements neither behavior and does not claim either discrepancy is resolved.

## FR-030–FR-032 attempt integration boundary (this increment)

- Real route: `POST /api/v1/quizzes/:quizId/attempts`. Layering: router → auth/role/schema middleware → controller → service/scorer → repository.
- **Production startup supplies the shared `createAuthenticate()` middleware** to quiz and attempt routes through `createAuthenticatedFeatures()`. Bare `createApp()` calls remain fail-closed unless explicitly configured. The server never accepts identities from client JSON, fake tokens or custom identity headers. Test-only identity injection is not production authentication.
- Wiring point: `createApp({ ..., attempts: { authenticate: actualVerifiedAuthMiddleware } })`; the middleware must populate trusted `req.auth = {userId, role, contributor}` with `userId` a stringified MongoDB ObjectId. Align the adapter once with Anisha's final context; do not duplicate JWT verification or add a dev bypass. Student (including contributor) allowed; educator/admin denied.
- Repository reads only server-side `quizzes` scoring data, using `_id` + `status:'published'`, projection `_id,allowRetake,questions`. No competing Quiz schema is registered. Ayush must confirm stored question `_id`, `type`, `options`, `answerKey` and Boolean `allowRetake` match SAD. This private lookup is not a client quiz endpoint and does not make answer keys public.
- Body follows SAD §4.3.4. Wrong types, unknown/duplicate question IDs are 400. Extra top-level client scores/identity/results are stripped and ignored. Null, omitted response or omitted question means unanswered; 0 and false remain valid answers.
- Persist score/maxScore and the complete per-question historical outcome/correct-answer snapshot before returning 201. Response is `no-store`. The student attempt and immediate result screen is implemented at `/quizzes/:quizId/attempt`. History/dashboard remain separate Sprint 2 work.
- Concurrent no-retake safety uses the proposed internal storage extension recorded as DEV-05: optional `retakeGuard` plus a partial unique index, alongside the required existing-attempt check. Multiple attempts remain allowed for `allowRetake:true`. Review the extension with the database owner before integration.
- MongoDB is required; no in-memory fallback for application persistence. Index build/DB failures fail the request rather than produce a false 201. Tests inject mock repositories separately; the supplied real MongoDB script verifies storage and races in an isolated random test database.
- Do not close #26 until real verified-auth/published-quiz integration and relevant acceptance evidence pass. FR-031 scorer and FR-032 UI have isolated test evidence; do not mark the full integrated flow Done until real authentication/quiz-route wiring is verified.

- Optional repository adapter: `createAttemptRepository({ findQuizForScoring: createQuizService().getQuizForScoring })` can reuse Ayush’s server-only lookup. This is never imported by the client. Production now uses this private adapter; the direct collection lookup is retained for isolated repository use.
- Frontend uses the existing shared Axios instance. The student entry page signs in through the real `/auth/login`, keeps access tokens only in React memory and passes Bearer headers explicitly. It does not persist tokens or accept server identity through URL/body fields. It requires re-login on 401; automatic token refresh remains shared-client follow-up work.
- Public quiz GET is validated/projected to public fields. Answer keys are shown only from the acknowledged submission response. Results appear without a page reload; 0 and false are preserved, omitted/null answers remain blank.
- The new AppRoutes is mounted inside the existing BrowserRouter in main.jsx. Coordinate later route additions in the same router rather than nesting another BrowserRouter.

## Registration Contract — FR-001

### Shared User model

- Model file: `server/src/models/User.js`
- Export: CommonJS default Mongoose `User` model.
- Collection: `users`.
- Registration endpoint: `POST /api/v1/auth/register`.
- Successful response: HTTP `201` with a `{ user: ... }` object.
- The response must not expose the password or `passwordHash`.
- Password hashes use bcrypt with cost factor 12 and are excluded from default User queries.
- Email addresses are trimmed and lowercased before storage.
- The accepted role values are `student`, `educator`, and `admin`.
- Public registration always assigns `role: student` and `contributor: false`. Client-supplied role and contributor values must not grant privileges.

### Password security clarification

Registration rejects passwords longer than 72 UTF-8 bytes before hashing or persistence. This limit prevents bcrypt from silently treating passwords with the same first 72 bytes as equivalent.

This is a working security clarification for implementation; it is not represented as an explicit maximum specified by the original SRS. The submitted SRS, SAD, and STP PDFs remain unchanged.

Password validation in future login, password reset, and password change flows must be consistent with the registration policy. Any user-facing password guidance should distinguish UTF-8 byte length from character count.

### Current authentication scope

FR-001 provides backend registration and the shared User model. It does not, by itself, implement verified login, JWT authentication middleware, refresh-token handling, logout, or the complete browser registration UI.

Protected-route integration must use the agreed authentication context:

`req.auth = { userId, role, contributor }`

Protected requests must obtain current user privileges from the database so role or contributor changes can take effect. Do not create production test identities or introduce fake authentication middleware to bypass integration requirements.
