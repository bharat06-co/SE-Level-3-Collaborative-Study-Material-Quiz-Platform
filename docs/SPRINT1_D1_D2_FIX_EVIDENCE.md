# Sprint 1 D1/D2 fix evidence

Date: 24 October 2026. Branch: `fix/sprint1-audit-defects`.
Baseline: `6f9ad5a120c2915ace39c9c3a395960d5fbbd191`.

## Audit references and scope

The supplied `SPRINT1_AUDIT_BUNDLE.zip`, `SPRINT1_DEFECTS.md` identifies:

- **D1:** FR-012 / #10 material pagination and existing quiz listing; tied creation timestamps produce duplicated and omitted rows. Evidence: `evidence/pagination-tie-probe.json` and `evidence/additional/quiz-pagination-tie-probe.json`.
- **D2:** FR-013 / #12 owner/admin material sharing; concurrent visibility and recipient changes produce incompatible field values. Evidence: `evidence/visibility-race-probe.json` and `evidence/additional/shared-empty-race-probe.json`.

Only these two defects are changed. The audit documents were treated as evidence, not authorization for other fixes. No Sprint 2 feature, SRS/SAD/STP, dependency, frontend, production database, or shared database changes are included.

## Implementation

D1 adds descending `_id` as the final sort key in both repositories. Quizzes and ordinary material searches still sort by descending `createdAt`; material full-text searches still rank text relevance first, then descending `createdAt`, then `_id`. Response pagination fields and filters are unchanged.

D2 replaces the unconditional material write with `findOneAndUpdate` matching `_id` and the snapshot's `__v`, setting both sharing fields and incrementing `__v` in one atomic write. A stale match returns no document. The service rereads, rechecks existence and owner/admin authorization, and recomputes/validates the complete sharing state before retrying. Three unsuccessful attempts return HTTP 409, code `MATERIAL_CONFLICT`, using the existing error envelope. Existing PATCH aliases, request bodies and success response shapes are preserved; the internal version is not exposed.

Shared materials require at least one unique non-owner recipient. Private/public materials clear recipients, including recipient-only requests evaluated against a fresh non-shared state. Visibility updates do not write or remove file bytes.

## Environment and isolation

- Windows; Node **v24.22.0**; npm **11.19.1**; MongoDB **8.2.1**.
- `mongodb-memory-server` starts owned disposable MongoDB processes with temporary data directories and random loopback ports. The new suite uses a random `sprint1_audit_*` database, drops it during teardown and stops its MongoDB replica set.
- Two independent Node API processes run the existing application, repositories and authentication middleware against that database and one temporary upload directory. Real login tokens are used. API listeners bind only to `127.0.0.1` on random ports. Test accounts, passwords and signing secrets are disposable.
- The harness supplies its own URI and storage path, loads no application `.env`, and has no fallback to an existing database. Parent-process MongoDB reads independently inspect the state persisted by the two API processes. Owned API processes and temporary files are cleaned up.
- Commands used `MONGOMS_SYSTEM_BINARY=C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe` and `MONGOMS_SYSTEM_BINARY_VERSION_CHECK=false` to use the installed binary rather than download the package's default version.

## Results actually observed

| Run | Command / check | Result |
| --- | --- | --- |
| Initial environment attempt | `npm test --workspace server -- --runTestsByPath tests/sprint1.audit.integration.test.js` inside the restricted sandbox | **Infrastructure failure:** MongoDB startup failed with `fassert` / loopback `EACCES`; all 6 cases failed in setup. This did not verify either defect. Reran with local networking permitted. |
| Before production-code changes | Same command, with local networking permitted | **6 expected regression failures**, confirming D1 and D2 against the baseline. Details below. |
| After fixes, before adding the 16-request wave case | `npm test --workspace server -- --runTestsByPath tests/sprint1.audit.integration.test.js tests/material.service.test.js` | **PASS:** 2 suites, 53 tests. |
| Lint / diff review | `npm run lint`; `git diff --check` | **PASS.** |
| Final full check, including the wave case | `npm run check` | **PASS, exit 0:** lint; 20 backend suites / **482 tests**; 10 frontend suites / **74 tests**; coverage thresholds; Vite production build. No skipped tests were reported. |
| CI runtime dependency check | `npm run audit:runtime` | **PASS, exit 0:** 0 vulnerabilities reported by npm. |

### Before-fix reproduction

Each D1 fixture contained 25 records with identical creation timestamps. Three consecutive pages contained 25 rows but only **19 unique quiz IDs**, **19 unique ordinary material IDs**, and **18 unique full-text material IDs**. A fourth page correctly had no rows; it could not recover omitted records.

Across two API processes, 24 simultaneous request pairs per scenario produced:

| D2 scenario | Invalid persisted states before fix |
| --- | --- |
| Shared to private, racing recipient-only change | **8/24** private records retained recipients |
| Shared to public, racing recipient-only change | **7/24** public records retained recipients |
| Private to shared, racing recipient-only change | **5/24** shared records had no recipients |

Both responses in each pair were HTTP 200. These are observed counts from this run; race frequencies depend on scheduling.

### Final regression coverage

All 13 cases in `server/tests/sprint1.audit.integration.test.js` passed as part of the final full check:

- Quiz pagination, ordinary material pagination and equal-score full-text pagination each return all **25 distinct IDs exactly once** across pages of 10/10/5, followed by an empty page. Expected ID order is also checked.
- Both resource types preserve descending creation-date precedence; material text relevance outranks creation date, and creation date breaks equal relevance scores.
- Each of the three D2 schedules runs **24 pairs** across two API processes and both PATCH aliases: **0/24 invalid states per scenario**, with both requests acknowledged in each pair.
- Both aliases reject unauthenticated/non-owner requests and invalid sharing requests without changing the persisted document, including its version/timestamps. Owner recipient normalization, admin moderation and revoked recipient file access remain correct.
- Two simultaneous repository updates using one version produce exactly one successful atomic write and one stale rejection. Subsequent stale writes and a MongoDB validation failure leave the winning persisted document unchanged.
- Four waves of **16 simultaneous requests** (64 total) mix private/public/shared changes and recipient-only changes, owner/admin callers and both aliases. HTTP 200 responses describe valid sharing combinations; 400/409 errors use the expected codes. The persisted version equals the total acknowledged writes after every wave, and every final sharing state is valid.
- After race, rejection and stale-write scenarios, stored and downloaded file **SHA-256 hashes** match the original upload, stored size matches the bytes, and there is exactly one material row and one expected file.

Six added service cases deterministically verify stale-snapshot recomputation in both directions, rejection when a fresh shared state makes empty recipients invalid, fresh existence/ownership checks, and a bounded 409 after repeated conflicts. Existing service tests were updated for the versioned repository operation.

The full check also runs existing authenticated material/quiz/attempt integration, auth/admin, role permission matrix, input security, file validation/storage and material text-index migration suites. Backend coverage: **97.39% lines, 94.80% statements, 97.51% functions, 88.45% branches**. Frontend coverage: **87.37% lines, 85.35% statements, 83.59% functions, 86.29% branches**.

## Evidence retention and limits

Local raw outputs are retained under ignored `test-results/sprint1-audit/`: `before-fix.log`, `after-fix-focused.log`, `npm-check.log`, and `npm-audit-runtime.log`. Coverage reports are under ignored `server/coverage/` and `client/coverage/`. The first sandbox setup error is recorded in the chat tool output and summarized above.

MongoDB 7.0.14 from the original audit: **NOT VERIFIED in this fix run**; the executed database tests used 8.2.1. Concurrency coverage is bounded to the schedules/waves above. Pagination guarantees are checked against an unchanged fixture dataset; this fix does not introduce snapshot pagination across concurrent inserts/deletes. No production/shared database was contacted.
