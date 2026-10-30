# Sprint 2 — isolated acceptance evidence for NFR-007 (#39) and NFR-001 (#32)

This PR **adds executable verification**, not preclaimed passing acceptance. Neither issue should be closed until real results pass and the evidence is reviewed. All tests are separate from the shared development or evaluation database.

## Execution

### Automated GitHub Actions

Opening a PR that changes the acceptance script or workflow triggers the **Isolated NFR-007 durability and NFR-001 load acceptance** workflow. It provisions its own Docker Compose project and MongoDB 7 volume, builds the current app, performs all checks, uploads evidence even on failure and deletes **only** that project's test containers/volumes. `workflow_dispatch` is available after the workflow is present on the default branch.

### Windows / GitHub Desktop local

From a PowerShell window at the repository root with Docker Desktop running:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/nfr/run.ps1
```

The script generates an ephemeral JWT secret, creates a unique Compose project name, records logs in `nfr-results/` (Git-ignored) and removes only that project's disposable containers/volumes afterward. The run takes at least 10 minutes because that duration is an acceptance requirement. It does **not** operate on the regular `compose.yaml` volumes.

## NFR-007 — actual checks

1. Start an isolated MongoDB 7 replica set, production API and nginx frontend.
2. Register and log in a real student over HTTP; insert a valid published allow-retake quiz in the *isolated test database*.
3. Submit one quiz attempt through the real authenticated HTTP API and check HTTP 201.
4. Make 100 concurrent valid authenticated requests to the POST scoring endpoint; require exactly 100 HTTP 201 responses and 100 distinct persisted attempt IDs, in addition to the baseline attempt.
5. Restart **only the API container** (`docker compose restart api`), leaving the isolated MongoDB volume and container intact.
6. Verify the original acknowledged attempt and all 100 parallel attempts in MongoDB. Log back in through the restarted API and confirm the attempt history contains 101 entries and its progress timeline contains 101 entries.
7. Preserve timestamped pre/post-restart evidence.

Pass = both numbered issue criteria met. This validates persistence across an **API** restart, not MongoDB disaster recovery, power loss, or a database-cluster failover. An isolated *test-only* student password is stored in the script, never a production credential; its database volume is discarded after the run.

## NFR-001 — actual checks

The **current** `nfr001-stp.js` script implements STP v1.0 **TC-PERF-01** with 100 concurrent users for 10 minutes and seeded mixed traffic. A guarded `nfr001-seed.cjs` creates 40 public **metadata-only** study-material records in the disposable MongoDB. `k6` registers and authenticates 100 test students and maintains four simultaneous 25-VU scenarios:

- `page_clients`: full production HTML and JS/CSS asset HTTP fetches, plus authenticated attempt-history data request.
- `browse_clients`: real authenticated material-list and material-detail HTTP requests.
- `search_clients`: authenticated MongoDB full-text material search over the seeded records.
- `scoring_clients`: valid quiz answers, server scoring and acknowledged MongoDB attempt inserts.

The workload checks all four operations, includes a 0% HTTP 5xx threshold, and requires 100% functional checks (including HTTP 201 with correct scores). The page p95 and attempt-submit p95 thresholds remain those in NFR-001:

- `page_load_ms` p95 ≤ 3000 ms; `page_success` ≥ 95%.
- `http_req_duration{kind:submission}` p95 ≤ 2000 ms.
- Both reliability metrics also require 100% successful operations for this stricter STP/NFR-002 combined run; `http_req_failed` must be 0%.

**The previous Actions run 40633812394 was a successful 50/50 page/submission baseline; it did not include browse/search and is NOT proof of the STP mixed-traffic requirement.** The updated workflow measures the mixed workload on a GitHub-hosted runner. The same suite must also be run on the STP §6 Linux VM (**2 vCPU, 4 GB RAM**) for a reference-environment claim; use `bash scripts/nfr/run-stp.sh` on that isolated staging/demo host (requires Docker Compose, Bash, OpenSSL, and a free 127.0.0.1:18080 bind). Never attach these tests to the shared development database. This run is destructive **only to its self-created unique Compose project and its test volumes**; use a host where the load itself cannot interfere with other teams' services.

**Runtime deviation:** STP §6 lists Node.js 20, while the current production Dockerfile uses Node.js 24. Record this difference and obtain evaluator approval or update the documented test baseline before claiming literal STP-environment parity.

**Measurement limitation:** HTTP-level HTML+asset fetching cannot measure browser execution, paint or client-side route rendering. If the evaluator defines “page load” as rendered browser load, perform that separate browser measurement before accepting NFR-001. Results are specific to the CI runner's hardware and deployment; compare the environment with STP §6 before marking the issue complete. No performance compliance is claimed in advance.

## Evidence and closure

Artifacts: `environment.txt`, `nfr007-before.log`, `nfr007-after.log`, `nfr001-seed.log`, `nfr001-stp-k6.log`, `nfr001-summary.json` under the workflow's uploaded artifact or local `nfr-results/` folder. Attach artifact link, commit SHA, Docker/MongoDB and k6 environment details, measured page p95 and scoring p95 to both issues. **Only then** check off and close #39 and #32 if the documented environment is acceptable. The durability result also supports #29 (FR-033), while the separate student-browser verification remains required before closing #29/#30.

## Reference-environment STP acceptance checklist for #32

1. Confirm the host matches the STP §6 2-vCPU/4-GB Linux VM, record actual `nproc`, `free -m`, Docker versions, git SHA and full-stack configuration from `${stamp}-environment.txt`.
2. Confirm seeded materials count 40 and full-text search initialization succeeded; retain `${stamp}-seed.log`.
3. Confirm k6 `vus_max: 100`, four distinct 25-VU scenarios, 10m configured duration, and no interrupted or unsuccessful checks.
4. Record `page_load_ms p(95)`, `http_req_duration{kind:submission} p(95)`, page/submit/browse/search success and zero 5xx; retain log and JSON summary.
5. Note that this is **HTTP-level** page-load latency, not browser-render timing; browser measurements require a separate controlled browser harness if that is the evaluator's interpretation.
6. Attach evidence link to #32. Do not close it solely because a GitHub-hosted run passes if the stipulated staging hardware/environment was not verified.

**Safety:** the seeded metadata-only materials have deliberately nonexistent example file objects. File downloads are not exercised in TC-PERF-01; this is explicitly a browse/search/attempt acceptance workload, not an upload/download throughput test.


## NFR-004 inline validation (#35A)

Client forms validate locally before submission and display field-level messages with `aria-invalid`/`role="alert"`:

- material upload/edit, comment, rating, report and moderation forms;
- student and quiz-author sign-in forms;
- student quiz-ID entry, quiz-author open-by-ID and leaderboard query forms;
- the quiz editor, which already had inline question/option validation.

Server validation remains authoritative, and field errors returned in the central error envelope are mapped back to the corresponding material inputs. The quiz attempt answer form intentionally has no required-answer validation because blank answers are explicitly scored as unanswered/zero rather than treated as an invalid form.

Automated coverage is in `client/tests/formValidation.test.js`, `MaterialSignIn.test.jsx`, `MaterialForm.test.jsx`, `MaterialLibraryPage.test.jsx`, `MaterialDetailPage.test.jsx`, `MaterialSession.test.jsx`, `StudentAttemptPage.test.jsx`, `QuizAuthoringPage.test.jsx`, `QuizEditor.test.jsx`, `LeaderboardPage.test.jsx` and `materialApi.test.js`.

The material flow also has a real-stack integration suite, `client/tests/material.fullstack.test.jsx`. It drives the actual React pages through the real Axios client, Express routes, authentication and a disposable MongoDB replica set. It covers shared library-to-detail session use, rating and comment persistence, owner revision creation, and the admin uphold-then-dismiss moderation regression.

The session kit is in [`docs/NFR004_USABILITY.md`](NFR004_USABILITY.md). It provides the TC-UX-01 protocol, a disposable five-account DBMS quiz environment, the neutral task card and observer rule, evidence tables, and a Chromium check covering the material-to-related-quiz flow, leaderboard and quiz-open-ID forms, and inline validation. Reproduce the browser evidence with:

```bash
npm ci
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install chromium
npm run nfr004:session:verify
npm run nfr004:validation
```

The #35B usability session with five real participants has **not** been conducted. Do not close #35 on automated validation checks alone. Complete the participant and form-observation tables in the session kit at the recorded commit before closure.
