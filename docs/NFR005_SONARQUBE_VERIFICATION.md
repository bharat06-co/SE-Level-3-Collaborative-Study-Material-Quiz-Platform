# NFR-005 / Issue #36 - Fresh merged-main scan evidence

**Fresh supplied NFR-005 verification: PASS for all five technical acceptance criteria; ready for independent review with the qualifications below.** Commit **`942cf9ed65099441b30c704a388fd882f0a1d876`** is confirmed by the copied Git record and associated with this run by the owner. The scan itself has SCM publishing disabled and does not embed that revision SHA. Test totals **594 backend + 122 frontend = 716 passed** are **owner-confirmed**, not independently verified execution results in this package. No historical scan or Jest summary is substituted.

## Requirement, TC-MNT-01 and PR #93

NFR-005 / original STP **TC-MNT-01**, related merged PR **#93**: genuine SonarQube gate passes, no blocker/critical issues, >=70% core-module unit-test line coverage, authentication/material/quiz/attempt/scoring covered, and SonarQube/Jest coverage reports preserved.

| Acceptance criterion | Fresh supporting evidence | Assessment |
|---|---|---|
| Code passes SonarQube gate | Server status OK/PASS; scanner exit 0; compute SUCCESS | PASS, subject to disclosed small-change exemption |
| No blocker or critical issues | Full open-issue export: 0 BLOCKER, 0 CRITICAL, 8 MAJOR, 1 MINOR | PASS; 9 lower-severity findings remain open |
| Core-module line coverage >=70% | Native LCOV and imported normalized copies; all five services >70% | PASS |
| Authentication, materials, quizzes, attempts and scoring covered | Each service has verified executable-line, function and branch hits | PASS |
| SonarQube and Jest coverage evidence retained | Authentic raw exports/native LCOV/scanned LCOV plus derived metrics and four reports | PASS; Jest execution totals remain owner-confirmed |

All five technical criteria are supported by the fresh scan/coverage artifacts. No fresh assertion of independently verified Jest test totals or automatic scan-time Git revision binding is made.

## Exact fresh run

Project **study-platform-nfr005-local**, version label **0.1.0-part3** (not a commit identifier). SonarQube Community Build **26.10.0.133078**, scanner **8.1.0.6389**, JavaScript analyzer **14.0.0.46108**. The fresh log records 167 indexed files and 154 language-associated analyzed source/test files; 97 production file measures are exported. Recorded generated exclusions are node_modules, coverage and dist. No new source exclusions are introduced here.

| Event | UTC, 3 November 2026 | IST, 3 November 2026 |
|---|---|---|
| Scanner invocation starts | 06:24:39.093164 | 11:54:39.093164 |
| Analysis timestamp from server | 06:24:59 | 11:54:59 |
| Report submitted | 06:27:50 | 11:57:50 |
| Compute task starts | 06:27:51 | 11:57:51 |
| Compute task succeeds | 06:28:03 | 11:58:03 |
| Scanner ends, exit 0 | 06:28:07.651319 | 11:58:07.651319 |

Analysis **a5c1e10e-2804-49f7-801b-4dc55722eaf0**; compute task **21c9cba5-4cff-49a5-ac54-0512cd9312a6**, SUCCESS. [Execution](part3-evidence/nfr005-main-a5c1e10e/sonar-execution.json), [compute task](part3-evidence/nfr005-main-a5c1e10e/sonar-compute-tasks.json), [analysis history](part3-evidence/nfr005-main-a5c1e10e/sonar-analyses.json), [exact numbered log excerpts](part3-evidence/nfr005-main-a5c1e10e/scanner-excerpts.json). Only the fresh analysis is used; older entries remain untouched inside the authentic API history export.

## Actual quality gate and small-change exemption

The [fresh gate](part3-evidence/nfr005-main-a5c1e10e/sonar-quality-gate.json) returns **OK/PASS**, `ignoredConditions=true`, **75.0% new-code combined coverage**, **0.0% new-code duplication**, and **0 new violations**. The recorded coverage threshold is 80%, duplication threshold 3%, and new violations threshold 0. The **SonarQube small-change exemption is fully disclosed**: 75% is below 80%, so this is not an unconditional 80% coverage achievement. No condition was weakened or changed by this packaging task. The owner confirms the small-change exemption; the fresh gate independently confirms ignored conditions. Current settings/new-code denominator exports were not provided, so no previous run's new-line/condition denominators are reused.

NFR-005's original threshold is >=70% **line coverage on core modules**, not 80% combined new-code coverage. It independently passes in all five services. Line, branch, function, and Sonar combined coverage are different metrics and are not substituted for each other.

## Findings and remaining risk

The [complete fresh open-issue export](part3-evidence/nfr005-main-a5c1e10e/sonar-issues.json) contains **8 MAJOR and 1 MINOR**, no blocker/critical findings. All nine are still open; none is suppressed, accepted, excluded or relabelled. [Overall measures](part3-evidence/nfr005-main-a5c1e10e/sonar-measures.json): **2 bugs, 1 vulnerability, 6 code smells, 0 hotspots**; security C, reliability C, maintainability A. Source-code vulnerability counts are distinct from dependency-audit counts. Individual issue creation dates can predate this analysis; their original timestamps are preserved.

Remaining rules concern regex backtracking, refresh-result nullability, an unobserved async return, a pseudorandom storage-key suffix and an object default argument. Their exact paths, lines, messages and severities are in the JSON. Community Build's limited security analysis and a passing quality gate do not constitute comprehensive deployment/OWASP acceptance.

## Verified native LCOV coverage

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

All percentages are calculated from authentic counters using Jest/Istanbul's two-decimal truncation convention. No historical JSON summary or coverage-final.json is used. Full module-group executable lines also exceed 70%: auth 240/266 (90.22%), materials 472/497 (94.96%), quizzes 118/119 (99.15%), attempts/scoring 152/152 (100%). [Native-derived counters](part3-evidence/nfr005-main-a5c1e10e/lcov-derived-metrics.json).

Both native LCOV SHA256 values **exactly match the fresh scanner execution record**. The original mapping transforms only SF paths to server/src or client/src; each other LCOV record is identical to the imported copies. Every DA/FN/FNDA/BRDA record and LF/LH/FNF/FNH/BRF/BRH summary has been reconciled. Fresh log excerpts identify both imported paths; [all file measures](part3-evidence/nfr005-main-a5c1e10e/sonar-file-measures.json) independently corroborate core coverage. Sonar overall line/branch/combined coverage is **89.7% / 82.3% / 86.7%**, under its own definitions, not substituted for Jest/LCOV percentages.

## Provenance and execution qualifications

The supplied [Git commit](part3-evidence/nfr005-main-a5c1e10e/git-commit.txt) contains exactly `942cf9ed65099441b30c704a388fd882f0a1d876`. [Git status](part3-evidence/nfr005-main-a5c1e10e/git-status.txt) contains only `?? docs/part3-evidence/`, with no tracked modifications recorded. These files retain their original bytes/encoding and hashes. They do not contain an embedded command-capture timestamp, branch-name output or source-file hash manifest. File modification times are recorded as filesystem metadata, not scan-time attestations.

The fresh scanner execution record mounts the original repository read-only into /usr/src; that path was read only as text in the supplied copy and was **not accessed**. The scan log says SCM Publisher is disabled, and no supplied scan JSON/log embeds the commit SHA. Thus the run-to-commit association is **owner-confirmed and supported by the copied Git records**, not an independently cryptographic snapshot throughout scan execution. This is disclosed rather than inventing a sonar.scm.revision value. The absence of such binding does not turn the genuine fresh scan into historical evidence.

The owner confirms 594/594 backend and 122/122 frontend passes. The original PowerShell execution log and machine-readable Jest results have not been supplied, so those test totals remain **owner-confirmed**. Fresh suite/skip/todo counts, durations and test-run timestamps are unavailable and are not copied from older runs. The current Jest setup does not emit coverage-final.json; none is created or required here. Statement coverage is unavailable from LCOV and is not fabricated.

For stronger final provenance, attach the original test execution log with its revision/command context and, if required by review, a contemporaneous Git/worktree/source-hash attestation. No original repository or GitHub access was performed for this package.

## Report reconciliation and package boundaries

The previous staged/working reports describe an older genuine local analysis; their matching line/branch values are not being reused as fresh evidence. This package uses **only** the explicitly supplied fresh copy, its native LCOV and Git records. The four reports are single current versions with a common evidence basis and no duplicated historical report payload. Working Part 3 reports, browser compatibility and deviation documents remain untouched.

The integration manifest lists exact proposed destination paths, SHA256, byte counts, original source hashes and retained filesystem timestamps. It includes no scanner credential, database/volume, full scanner log, screenshot, cache, temporary file, backup, HTML coverage tree or source patch. **Ready for independent review with the test-count and scan-time Git-binding qualifications explicitly stated.** No integration, GitHub operation, push, commit, merge or original repository modification occurred.
