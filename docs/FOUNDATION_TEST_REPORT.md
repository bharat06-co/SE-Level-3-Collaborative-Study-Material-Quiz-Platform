# Foundation test report

Prepared at UTC: 2026-10-17T06:00:56+00:00. Baseline repository commit: `b800354`.

## Scope
Only shared foundation code. These results do NOT complete the original 121 STP cases or any domain FR/NFR/SEC issue. No authentication, material, quiz or scoring feature has been implemented here.

## Actual executed checks
- Clean root `npm ci`: passed on Node 24.22.0 / npm 11.11.0 after the runtime upgrade.
- `npm run lint`: passed.
- Server Jest/Supertest: **28 tests passed**.
- Client Jest/React Testing Library: **8 tests passed** across two suites.
- `npm run check` (lint, coverage tests, frontend build): passed on **Node 24.22.0**.
- Vite production build: passed.
- Foundation measured server line coverage: **97.36%**; client line coverage: **100%**.
- Runtime dependency `npm audit --omit=dev`: **0 reported advisories** at check time.
- Full dependency audit: **0 critical, 0 high, 19 moderate**. The remaining moderate findings are the development/test coverage-tool chain involving `@istanbuljs/load-nyc-config → js-yaml 3 → argparse → sprintf-js` (advisory GHSA-hp3w-g68c-fv3c). Latest selected Jest/Babel tools still pull this chain. They are NOT in the runtime-only audit. This is a known development dependency issue, not a clean full audit or a passing SonarQube gate. Review upstream fixes before running untrusted configuration; do not blindly force-downgrade test tools to satisfy an automated suggestion. Recheck before merge/deployment because advisories change.

## Actual live integration smoke run
Used an isolated temporary **MongoDB 7.0.14 test instance**, the real API process on Node 24.22.0, Vite, and sandbox-local headless Chromium. The temporary database had no real personal data and was stopped after the test. This binary/version is a test fixture, not a recommended production deployment pin.

- PASS: MongoDB 7.0.14 temporary test instance started
- PASS: Real API startup and MongoDB-connected health response passed
- PASS: Actual HTTP 404 error envelope passed
- PASS: Bundled read-only HTTP smoke script passed against real running services
- PASS: Desktop Chromium: React → Vite proxy → Express → MongoDB connection check passed
- PASS: 360px Chromium layout has no horizontal overflow; retry works
- PASS: Stopped database produces health 503 and honest unavailable UI

Browser smoke used desktop 1280×850 and mobile-width 360×800 viewports. Visual screenshots were inspected for layout; this is not full usability/accessibility/cross-browser acceptance. A database outage was explicitly exercised and correctly changed health to HTTP 503 and the UI to unavailable.

## Coverage limits and unrun checks
- Initial coverage instrumentation excludes server startup, DB connection and logger plumbing plus the React entry file. Those paths have some live smoke coverage but are not counted in the reported percentages.
- The core business modules do not exist yet; these percentages are NOT the NFR-005 coverage evidence for completed core services.
- Docker/nginx builds and `docker compose up` were NOT executed: no Docker CLI/daemon was available. YAML parsed successfully; static check confirms no published Mongo/API ports and only localhost-bound web port. Validate on a Docker-enabled laptop.
- GitHub Actions has NOT been run in this preparation session. It runs only after the owner pushes the branch/PR; inspect the actual remote run.
- SonarQube NOT configured/run. TLS/HSTS NOT implemented. Full STP, auth, file validation, rate limiting, roles, scoring, performance, availability, durability and multi-browser suites NOT completed.
- No product readiness/security guarantee is implied by passing foundation checks.

## Submitted PDF integrity
All three original PDFs were compared byte-for-byte with baseline Git content and were unchanged. The delivery archive excludes them entirely. It also excludes Git metadata, node_modules, real .env files, build output, coverage output, local test databases and logs.

## Reviewer decisions
Review `docs/DEVIATIONS.md`: health 503 SERVICE_UNAVAILABLE/payload is an owner-accepted technical clarification (DEV-03), and Node 24 LTS/npm 11 is an owner-authorised upgrade from the original SAD's EOL Node 20 (DEV-04). Independent peer PR review and any required faculty acknowledgement remain pending. Version files, all package engines, Docker build stages, CI and working setup docs were updated together; submitted PDFs remain untouched.
