# Team 1 — Collaborative Study Material & Quiz Platform

Shared MERN foundation for UE24CS341A. **This is a starter, not a completed feature implementation.** The submitted Part-1 PDFs remain unchanged. Use the combined `Team1_Deliverables_Part1_SRS_SAD_STP.pdf` (SRS v1.2, SAD v1.0, STP v1.0); the standalone SRS is historical v1.1.

## What works now
- npm workspace with React 18/Vite client and Express 4/Mongoose 8 backend.
- API health check of process and actual database connection.
- Central error envelope, request IDs, Helmet headers, restricted CORS and a basic nested operator-key rejection guard.
- Isolated Jest/Supertest API tests, React Testing Library tests, lint and build scripts.
- Push/PR GitHub Actions workflow and coverage artifacts.
- Docker Compose scaffold for nginx, API and MongoDB 7, with persistent named volumes and no published database port.

**Not implemented:** user accounts/authentication, any domain models or feature endpoints/screens, seed users, file/mail adapters, rate limits, deployment TLS, SonarQube integration, load/availability/security acceptance suites, or the final product. The baseline key guard is NOT full SEC-004 compliance. No issue should be closed just because this scaffold was merged.

## Prerequisites
Choose ONE running method below. For coding, use the local development method; Docker is a convenient alternative to check the built starter.
- Git/GitHub Desktop, an editor.
- **Node 24 LTS (latest available patch in major 24) and npm 11**. `.nvmrc`, `.node-version`, all package engines, Docker build stages and CI target major 24. The submitted SAD originally specified Node 20, now EOL; the owner authorised this working runtime upgrade (DEV-04). Submitted PDFs are unchanged. Validate `node --version` before installation and obtain Node from an official installation method.
- For local development: a running **MongoDB 7** installation/service or a private development MongoDB endpoint; use a separate development/test database. Do not target production/shared evaluation data.
- For Docker: Docker Engine/Desktop with Compose v2, running locally.

See `docs/FOUNDATION_TEST_REPORT.md` for the exact Node 24 patch actually tested. Installed dependency versions are recorded in `package-lock.json`. Do not downgrade to Node 20 merely to reproduce the historical PDF runtime.

## A. Local development — coding workflow
Run commands from the repository root (the folder containing this README and root package.json).

### 1. Install
```sh
npm ci
```
Run this once per clone and again when the lockfile changes. This is an npm workspace: install from the ROOT, not four separate folders. Commit intended lockfile changes when dependencies are added; coordinate changes to avoid conflicts.

### 2. Create local configuration files
Copy `server/.env.example` to `server/.env`, and `client/.env.example` to `client/.env`. Keep both examples in Git; never commit the actual `.env` files.

PowerShell (Windows), from root:
```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```
macOS/Linux, from root:
```sh
cp server/.env.example server/.env
cp client/.env.example client/.env
```
Only copy if the destination doesn't already contain your configuration. Do not overwrite another teammate's or your own configured file blindly.

Set `server/.env`:
- `MONGODB_URI`: your private local/development database; default `mongodb://127.0.0.1:27017/team1_study_dev`.
- `PORT=3000`.
- `CORS_ORIGINS`: exact frontend origins; defaults cover localhost/127.0.0.1 at 5173.
- `TRUST_PROXY_HOPS=0` for directly running the API locally. Never blindly set this to `true` on an internet-facing server.
- `LOG_LEVEL=info`.

The client calls relative `/api/v1`. Vite proxies it to `DEV_API_TARGET` (default `http://127.0.0.1:3000`). There are no auth tokens to configure yet. Never put secrets in `VITE_*` variables: browser bundles are public.

### 3. Start MongoDB
Use your OS's MongoDB service/startup process or an agreed private development endpoint. Exact service commands vary by OS/install. If MongoDB is unavailable, the API intentionally fails startup instead of pretending to be ready. No MongoDB installation is created by `npm ci`.

### 4. Start app
```sh
npm run dev
```
Open `http://localhost:5173`. You should see **API and MongoDB are connected.** The API is at `http://127.0.0.1:3000/api/v1/health`.

To run separately in two terminals:
```sh
npm run dev --workspace server
npm run dev --workspace client
```
Use Ctrl+C to stop. If setup fails, read `docs/TROUBLESHOOTING.md`; don't commit credentials or change shared contracts just to fix a local setting.

## B. Docker Compose — local development and authentication

### Prerequisites

Install and start Docker Desktop with Docker Compose v2. Run all commands from the repository root.

### 1. Configure the JWT secret

Create a root `.env` file before starting Docker Compose. Keep it private and never commit it.

Generate a cryptographically random 64-character hexadecimal secret using Node.js:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add the generated value to the root `.env` file:

```dotenv
JWT_ACCESS_SECRET=PASTE_YOUR_GENERATED_SECRET_HERE
```

Replace the placeholder with your generated secret. Never commit or share the actual value. The Compose configuration requires `JWT_ACCESS_SECRET` and passes it to the API.

A root `.env.example` is provided as a template. It contains a placeholder, not a usable secret. If you copy it to `.env`, replace the placeholder with your generated secret before starting Docker.

### 2. Validate and start Docker

```sh
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Wait for the MongoDB and API health checks to pass. MongoDB is configured as a single-node replica set named `rs0`, supporting database operations that require a replica set. Its port is not published to the host.

Verify the replica-set state:

```sh
docker compose exec mongo mongosh --quiet --eval "db.hello()"
```

Confirm that the output includes `setName: 'rs0'` and `isWritablePrimary: true`.

Check application health:

```sh
curl -i http://localhost:8080/api/v1/health
```

Expect HTTP 200 and a connected database status.

### 3. Verify authentication end to end

Use a dedicated local test account and verify the following:

- Registration succeeds with HTTP 201.
- Invalid login credentials are rejected with HTTP 401.
- Valid login succeeds with HTTP 200 and sets the refresh-token cookie.
- Refresh succeeds with HTTP 200 and rotates the refresh token.
- Logout succeeds with HTTP 200 and revokes the active refresh token.
- Reusing a revoked refresh token is rejected with HTTP 401.

Keep access tokens, refresh tokens, cookie jars, response files containing credentials, and `.env` files private. Use dummy accounts and local development data only.

### 4. Rebuild and stop Docker safely

After changes, rebuild the application:

```sh
docker compose up -d --build
```

Stop containers without deleting data:

```sh
docker compose down
```

This stops and removes containers while preserving named volumes. Do not use `docker compose down -v` unless you intentionally want to delete persistent volumes and their data.

Local Docker uses HTTP and is for development only. It does not provide production TLS and does not satisfy SEC-005; production TLS/redirect/HSTS and deployment configuration remain Sprint 2 work. Do not expose this application publicly as a secure production app.


## Checks (from repository root)
```sh
npm run lint
npm test
npm run test:coverage
npm run build
npm run check
```

With local app and MongoDB running, `npm run smoke` performs read-only HTTP checks. For Docker targets use `npm run smoke -- http://localhost:8080 http://localhost:8080`. For custom local ports supply the API origin then the frontend origin. `npm run audit:runtime` checks current runtime dependency advisories; audit results change over time.
`check` runs lint, coverage-enabled tests and the frontend build. Isolated tests do not require MongoDB or the production UI. Coverage reports are written to `server/coverage` and `client/coverage` and ignored by Git; CI uploads them as artifacts.

The initial 70% coverage thresholds apply to included scaffold code ONLY. `server/src/index.js`, database connection and logger plumbing, and `client/src/main.jsx` are excluded from that initial instrumentation. See `docs/FOUNDATION_TEST_REPORT.md` for actual preparation evidence. **This does not complete NFR-005 or NFR-008:** core modules/tests, SonarQube and corresponding acceptance evidence are still required. Do not lower thresholds to hide missing feature tests.

## Structure and contracts
```text
server/src/app.js          # constructs app without opening sockets or DB
server/src/index.js        # validates config, connects DB, listens, shuts down
server/src/config/         # env, logger, DB connection
server/src/middleware/     # shared request/error/security pipeline
server/src/modules/        # auth, materials, moderation, quizzes, attempts, analytics
server/src/adapters/       # storage/mail implementation by feature owners
server/src/utils/          # AppError and asyncHandler
server/tests/              # isolated foundation tests
client/src/api/            # shared relative API client
client/src/pages/          # feature pages to be added by owners
client/src/components/     # shared UI
client/src/context/        # auth context to be added by Anisha
infra/                     # local nginx configuration
```
Read `docs/CONTRACTS.md` before feature work. Each feature follows routes → middleware → controller → service → repository. Existing domain APIs are intentionally not stubbed to false success; unknown routes return 404 until implemented.

## Team workflow
1. Owner reviews and merges the foundation PR first; another teammate reviews Bharat's PR.
2. Everyone fetches/pulls current main.
3. Create a focused branch for an assigned issue, implement/tests, push and open a PR into main.
4. Include real test results and the actual GitHub issue number.
5. For incomplete supporting work use `Related to #...`, not `Closes #...`.
6. Owner coordinates review/merge; verify issue/Project Done after genuine completion.

Shared feature owners: Anisha accounts/auth; Aryaroop material/moderation/UI coordination; Ayush quizzes/leaderboard/database coordination; Bharat attempts/scoring/progress/error/integration.

## CI and remaining setup
`.github/workflows/ci.yml` runs on pushes and PRs with read-only repository permissions. It does not deploy. After pushing, inspect the actual Actions run; local passing checks do not prove GitHub-hosted CI has already run. Configure main-branch review/required checks separately after the job exists.

SonarQube is still required by NFR-005; no dummy quality gate is supplied. Add real integration/credentials safely when the owner provisions it. No code or acceptance suite is marked complete merely by a green foundation build.

The full dependency audit currently reports moderate findings in a test-only coverage-tool dependency chain; runtime-only audit reports none. See the test report for the scope and limitations. Do not claim a completely clean full audit or automatically force-downgrade test tools.

## Planning references
- Backlog: https://github.com/users/bharat06-co/projects/1/views/1
- Sprint 1: 17–23 Oct 2026. Sprint 2: 24–30 Oct 2026.
- See `docs/DEVIATIONS.md` for recorded working clarifications; submitted PDFs/history remain untouched.
