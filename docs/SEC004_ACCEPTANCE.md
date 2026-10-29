# SEC-004 / Issue #44 — Full application security acceptance

## Purpose and boundary

This adds an automated **real Chromium and MongoDB-backed** acceptance run for
SEC-004 (TC-SEC-04). It does not create bypass routes or change production
security middleware. It uses the application's actual Express routes, real
login-issued JWTs, material comments, React pages, and safe text rendering.

**Isolation:** `scripts/sec004-fixture-server.cjs` creates an independent,
disposable `mongodb-memory-server` replica set, two fixture users and one
public material. It listens on loopback with a random port. The frontend Vite
server also binds loopback. Test data and temporary files are removed at
shutdown. Neither script loads application `.env` or accesses Docker volumes,
VMs, local development MongoDB, or deployed/shared data.

## Coverage (TC-SEC-04)

- Real `POST /auth/login`, `/auth/register` and `/auth/forgot-password` reject
  MongoDB operator objects, including `$gt` and `$ne`, with HTTP 400.
- Real authenticated materials endpoints reject nested `$where`, prototype
  pollution (`__proto__`), dotted keys, operator-bearing ratings and reports,
  and operator-bearing metadata updates with HTTP 400.
- Rejected comment requests do not create records; rejected metadata updates
  do not alter the material.
- Ordinary authentication still succeeds.
- In real Chromium, a signed-in student posts **five hostile strings** through
  the actual material-comments form. Script, `onerror`, SVG, JavaScript URL,
  and entity-encoded text are displayed literally as React text, never as
  executable elements. No browser dialog or execution flag is allowed.
- Real authenticated GET `/materials/:id/comments` returns each exact string
  from disposable MongoDB-backed storage.

## Execution

Open a pull request containing the included scripts and workflow. The
`SEC-004 browser acceptance` Action runs independently of regular CI.
It uses Node from `.nvmrc`, installs locked project dependencies, temporarily
installs Playwright 1.56.1 without changing `package-lock.json`, downloads
Chromium and exercises the complete flow. It uploads
`sec004-chromium-evidence` with a JSON report and screenshot.

Optional local execution on a **separate** working directory with Node 24:

```powershell
npm ci
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install chromium
node scripts/sec004-browser-acceptance.cjs
```

The test fails nonzero if any assertion fails. Evidence is written under
`test-results/sec004/` (already ignored by Git). Avoid copying or uploading
an application `.env` or any private credentials.

## Acceptance and closure rule

- [ ] PR normal `CI` (lint, server/client tests, frontend build, audit) passed.
- [ ] `SEC-004 browser acceptance` completed **successfully** on the final PR
      head; save its run URL and attached evidence.
- [ ] Review JSON results for operator HTTP 400, no mutation, actual comment
      persistence, and inert browser rendering.
- [ ] Merge the reviewed PR into `main` and ensure no newer regression.
- [ ] Link the commit/CI run and update Issue #44 checklist, then close.

This validates the enumerated acceptance cases on the test environment. It
is **not** a comprehensive penetration test or proof against every possible
injection or XSS class, cross-browser behavior, or deployment configuration.
