# Part 3 - NFR-005 Unit Test Report

**Fresh supplied NFR-005 verification: PASS for all five technical acceptance criteria; ready for independent review with the qualifications below.** Commit **`942cf9ed65099441b30c704a388fd882f0a1d876`** is confirmed by the copied Git record and associated with this run by the owner. The scan itself has SCM publishing disabled and does not embed that revision SHA. Test totals **594 backend + 122 frontend = 716 passed** are **owner-confirmed**, not independently verified execution results in this package. No historical scan or Jest summary is substituted.

## Test execution evidence status

| Workspace | Owner-confirmed passed / total | Independently supplied execution evidence |
|---|---|---|
| Backend | 594 / 594 | Not supplied; original PowerShell execution log may be attached separately |
| Frontend | 122 / 122 | Not supplied; original PowerShell execution log may be attached separately |
| Total | 716 / 716 | Owner-confirmed; not presented as a machine-verified result |

No new tests were executed during packaging. Suite counts, failure/skip/todo summaries beyond the owner's all-pass statement, elapsed durations, runner version and test-execution timestamps are not independently available in the fresh copy. Historical run statistics are not substituted. No Jest JSON result, coverage-final.json or coverage-summary.json is manufactured.

## Independently verified fresh coverage

Native LCOV precedes the recorded scanner invocation in the supplied filesystem metadata, but file times are not used as test-execution timestamps. Both native-file hashes exactly match the scanner invocation's coverage inputs. Every detailed line/function/branch record reconciles with its declared counters, and SF-only normalization exactly reproduces the imported files.

| Workspace | Executable lines | Line % | Branch outcomes | Branch % | Functions | Function % |
|---|---|---|---|---|---|---|
| server | 1547/1617 | 95.67 | 940/1120 | 83.92 | 324/339 | 95.57 |
| client | 757/906 | 83.55 | 700/872 | 80.27 | 251/302 | 83.11 |

| Required backend service | Executable lines | Line % | Branch outcomes | Branch % | Functions | Function % |
|---|---|---|---|---|---|---|
| `server/src/modules/auth/auth.service.js` | 124/134 | 92.53 | 76/87 | 87.35 | 16/17 | 94.11 |
| `server/src/modules/materials/material.service.js` | 243/257 | 94.55 | 196/229 | 85.58 | 35/38 | 92.10 |
| `server/src/modules/quizzes/quiz.service.js` | 59/60 | 98.33 | 50/54 | 92.59 | 20/20 | 100.00 |
| `server/src/modules/attempts/attempt.service.js` | 18/18 | 100.00 | 15/15 | 100.00 | 4/4 | 100.00 |
| `server/src/modules/attempts/scoring.service.js` | 34/34 | 100.00 | 49/49 | 100.00 | 8/8 | 100.00 |

These counters establish coverage of authentication, material, quiz, attempt and scoring services for NFR-005 / TC-MNT-01. They do not independently prove how many Jest cases ran or isolate pure-unit coverage from integration coverage. The complete native inputs and derived calculations are retained; statements are not represented by LCOV and are unavailable here.

## Fresh Sonar result and PR #93

Fresh analysis **a5c1e10e-2804-49f7-801b-4dc55722eaf0** completed SUCCESS on **2026-11-03 at 06:28:03 UTC / 11:58:03 IST**, scanner exit 0, actual gate PASS, 0 blocker / 0 critical and nine lower-severity open findings. Commit **942cf9ed65099441b30c704a388fd882f0a1d876** is in the supplied Git record; the owner identifies it as merged main following PR #93. Exact limitations are in the [verification report](NFR005_SONARQUBE_VERIFICATION.md).

## Provenance and execution qualifications

The supplied [Git commit](part3-evidence/nfr005-main-a5c1e10e/git-commit.txt) contains exactly `942cf9ed65099441b30c704a388fd882f0a1d876`. [Git status](part3-evidence/nfr005-main-a5c1e10e/git-status.txt) contains only `?? docs/part3-evidence/`, with no tracked modifications recorded. These files retain their original bytes/encoding and hashes. They do not contain an embedded command-capture timestamp, branch-name output or source-file hash manifest. File modification times are recorded as filesystem metadata, not scan-time attestations.

The fresh scanner execution record mounts the original repository read-only into /usr/src; that path was read only as text in the supplied copy and was **not accessed**. The scan log says SCM Publisher is disabled, and no supplied scan JSON/log embeds the commit SHA. Thus the run-to-commit association is **owner-confirmed and supported by the copied Git records**, not an independently cryptographic snapshot throughout scan execution. This is disclosed rather than inventing a sonar.scm.revision value. The absence of such binding does not turn the genuine fresh scan into historical evidence.

The owner confirms 594/594 backend and 122/122 frontend passes. The original PowerShell execution log and machine-readable Jest results have not been supplied, so those test totals remain **owner-confirmed**. Fresh suite/skip/todo counts, durations and test-run timestamps are unavailable and are not copied from older runs. The current Jest setup does not emit coverage-final.json; none is created or required here. Statement coverage is unavailable from LCOV and is not fabricated.

For stronger final provenance, attach the original test execution log with its revision/command context and, if required by review, a contemporaneous Git/worktree/source-hash attestation. No original repository or GitHub access was performed for this package.

See the [code coverage report](PART3_CODE_COVERAGE_REPORT.md) and [branch report](PART3_BRANCH_COVERAGE_REPORT.md) for native-derived metrics. The original execution log, when provided, can strengthen the test-count evidence without inventing new results.
