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

`k6` creates 100 authenticated student accounts during setup, then maintains **100 constant concurrent virtual users for 10 minutes**: 50 repeatedly fetch the complete production HTML and its referenced JS/CSS bundles, while 50 post valid scored quiz attempts with real bearer tokens and MongoDB writes. The two HTTP scenarios run simultaneously, not as alternating stages. Each 201 creates a real new attempt; `allowRetake=true` is intentional.

Pass criteria:

- `page_load_ms` p95 ≤ 3000 ms, measuring full HTTP response time for HTML and its JS/CSS assets. Failed asset loads count as a slow page load. `page_success` ≥ 95%.
- `http_req_duration{kind:submission}` p95 ≤ 2000 ms and HTTP 201 submission-success rate ≥ 99%.
- A real **10-minute** duration and 100 VUs, with k6 summary and run environment saved.

**Measurement limitation:** HTTP-level HTML+asset fetching cannot measure browser execution, paint or client-side route rendering. If the evaluator defines “page load” as rendered browser load, perform that separate browser measurement before accepting NFR-001. Results are specific to the CI runner's hardware and deployment; compare the environment with STP §6 before marking the issue complete. No performance compliance is claimed in advance.

## Evidence and closure

Artifacts: `environment.txt`, `nfr007-before.log`, `nfr007-after.log`, `nfr001-k6.log`, `nfr001-summary.json` under the workflow's uploaded artifact or local `nfr-results/` folder. Attach artifact link, commit SHA, Docker/MongoDB and k6 environment details, measured page p95 and scoring p95 to both issues. **Only then** check off and close #39 and #32 if the documented environment is acceptable. The durability result also supports #29 (FR-033), while the separate student-browser verification remains required before closing #29/#30.
