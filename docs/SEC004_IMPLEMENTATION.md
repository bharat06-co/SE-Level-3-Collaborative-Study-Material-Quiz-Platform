# SEC-004 — Injection and plain-text safety

## Scope and status
Issue #44, SEC-004, Sprint 1, Bharat. Source: combined Part-1 SRS §5.1.2 / TC-SEC-04.

Implemented and tested shared safeguards plus safe attempt feedback rendering. **Keep full issue acceptance pending until real login/material-comment integration is verified.** FR-014 comments are Sprint 2 work owned by Aryaroop; no competing comment model, production test route or fake authentication was introduced.

This branch is based on Bharat's unmerged PR #57 (`0b5c6e207e2e1c3e2f5bdf0560461d154879d6bf`). Do not merge it before coordinating that dependency. No teammate PR code was merged or changed.

## Changes
- Iterative shared parsed-input guard: operator, dotted and reserved prototype keys rejected; arrays/nesting inspected; excessive depth/node count rejected without recursive stack overflow.
- Reusable `assertSafeInput` for service/schema boundaries and guard reusable after route-specific parsers.
- Plain-text validator: type, trimmed length and null-byte checks. HTML markup is preserved literally, never assumed executable HTML.
- Reusable React PlainText component. Actual attempt result question/answer labels use it; existing quiz/form React text nodes remain safe.
- Server/client regressions, plus an opt-in isolated real-MongoDB text fixture harness. The fixture is not a production comment implementation.

## Commands
From the repository root, Node 24.x / npm 11.x:

```powershell
npm ci
npm run check
$env:SEC004_TEST_MONGODB_URI = "mongodb://127.0.0.1:27017"
node scripts/check-input-security-mongo.cjs
Remove-Item Env:SEC004_TEST_MONGODB_URI
npm run audit:runtime
```

MongoDB harness rules: use a local MongoDB server only, no database path/credentials. It never loads application .env, generates a unique `team1_sec004_test_*` database and drops only that generated database in cleanup. It refuses remote/named database URIs. Its test-only fixture is registered exclusively in this script; do not copy its route into production.

## Executed evidence
Environment: Node 24.14.1 / npm 11.11.0, temporary MongoDB 7.0.14, headless Chromium.

- Full check: lint, 100 server tests, 54 client tests and frontend build passed.
- Real MongoDB: operator/prototype payloads returned 400 with no rows; five hostile text payloads were stored and returned literally; invalid type/length inputs created no records.
- Separate isolated Chromium check: actual PlainText component rendered those verified payload strings with no script/image/SVG/link/iframe elements, no execution flag and no dialogs. This browser harness was preparation evidence, not a committed full-app E2E suite.
- Runtime audit result recorded in delivery guide after execution.
- Original three PDFs unchanged.

Payloads covered script tags, image onerror, SVG onload, javascript links and entity-encoded script text. Tests also preserve apostrophes, dollar/dotted string values, zero/false/null answer values and legitimate text; no global destructive HTML stripping.

## Integration checklist before issue #44 is Done
- [ ] Real auth/login schema rejects operator objects with 400 before querying, no account bypass.
- [ ] Feature owners apply typed schemas and explicit MongoDB selectors/updates; run guard after multipart parsing where applicable.
- [ ] FR-014 real authenticated comment storage/read path preserves text, enforces ownership/access and length rules.
- [ ] Real comment page renders stored hostile input as text in a browser; no unsafe HTML or automatic unsafe URL interpretation.
- [ ] Merge/retest combined auth, quizzes, attempts and materials; repeat relevant SEC-004 checks.

No comprehensive penetration test, OWASP ZAP scan, cross-browser certification, Docker/deployment validation or protection against all possible injection contexts is claimed. This is defence in depth, not a guarantee of complete application security.
