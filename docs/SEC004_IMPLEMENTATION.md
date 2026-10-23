# SEC-004 — Injection and plain-text safety

## Scope and status
Issue #44, SEC-004, Sprint 1, Bharat. Source: combined Part-1 SRS §5.1.2 / TC-SEC-04.

Implemented and tested shared safeguards plus safe attempt feedback rendering. **Keep full issue acceptance pending until real login/material-comment integration is verified.** FR-014 comments are Sprint 2 work owned by Aryaroop; no competing comment model, production test route or fake authentication was introduced.

PR #57 is now merged into main. This branch incorporates current main, including the authentication error-code fix in PR #65. Quiz/attempt wiring and authentication contracts are preserved. The remaining checklist below is not satisfied merely by merging these shared safeguards.

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

## Original branch evidence (historical; see current integration evidence below)
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


## Current-main integration verification

This revision incorporates main through PR #65 (main snapshot `1243c4ed7ebacea584823d29affd47fe5b3df0c4`) and preserves the merged #57 production authentication, quiz and attempt wiring. The CONTRACTS.md conflict was resolved by retaining the current authentication/attempt contracts and appending the SEC-004 boundary guidance.

Added database-backed tests using the actual login/register routes and production feature composition. Operator/prototype login input returns 400 VALIDATION_ERROR before User.findOne, with no access token or refresh record. Registration operator input creates no user; ordinary login still succeeds. Authenticated quiz operator input returns 400, and invalid JWT handling retains the #65 TOKEN_INVALID mapping.

Executed on this integrated revision:
- `npm run check`: 212 backend tests, 61 frontend tests, lint, coverage thresholds and production build passed.
- `npm run audit:runtime`: zero known runtime dependency vulnerabilities reported at execution.
- Isolated real MongoDB fixture: unsafe objects produced no records; hostile markup round-tripped literally; invalid text did not create records.
- `git diff --check`: passed before commit.

These results are local automated checks. No new real-browser, Docker or shared-staging run was performed for this revision. The historical browser evidence above remains component/fixture evidence, not acceptance of an actual comment feature.

Issue #44 still explicitly requires inert storage/rendering through real comments. FR-014 is separate feature work; this PR does not add fake production comments to manufacture completion. Keep the issue open until that criterion and combined material-input integration are verified, or the human owner explicitly agrees and records a scope split. After materials #59 is updated, ensure rejectUnsafeKeys/assertSafeInput is executed after multipart parsing and verify its HTTP boundary cases.
