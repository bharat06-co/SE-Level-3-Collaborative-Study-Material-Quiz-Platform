# Part 3 - NFR-005 Branch Coverage Report

**Fresh supplied NFR-005 verification: PASS for all five technical acceptance criteria; ready for independent review with the qualifications below.** Commit **`942cf9ed65099441b30c704a388fd882f0a1d876`** is confirmed by the copied Git record and associated with this run by the owner. The scan itself has SCM publishing disabled and does not embed that revision SHA. Test totals **594 backend + 122 frontend = 716 passed** are **owner-confirmed**, not independently verified execution results in this package. No historical scan or Jest summary is substituted.

## Authentic fresh branch counters

Derived exclusively from the supplied native LCOV. Every BRDA outcome was counted: a positive integer is hit; zero or '-' is unhit. Detailed outcome counts match BRF/BRH in all 87 file records. No historical branch summary or manufactured execution result is used.

| Workspace | Covered | Total | Uncovered | Branch % |
|---|---|---|---|---|
| server | 940 | 1120 | 180 | 83.92 |
| client | 700 | 872 | 172 | 80.27 |

These reproduce the confirmed **83.92% backend / 80.27% frontend** figures using two-decimal truncation. Branches are instrumented conditional outcomes, not test counts, features or all possible inputs. A covered line does not establish all branches.

## Required services

| Core service | Branch hits/total | Branch % | Line hits/total | Line % |
|---|---|---|---|---|
| `server/src/modules/auth/auth.service.js` | 76/87 | 87.35 | 124/134 | 92.53 |
| `server/src/modules/materials/material.service.js` | 196/229 | 85.58 | 243/257 | 94.55 |
| `server/src/modules/quizzes/quiz.service.js` | 50/54 | 92.59 | 59/60 | 98.33 |
| `server/src/modules/attempts/attempt.service.js` | 15/15 | 100.00 | 18/18 | 100.00 |
| `server/src/modules/attempts/scoring.service.js` | 49/49 | 100.00 | 34/34 | 100.00 |

All five services exceed the NFR-005 >=70% **line** requirement; branch percentages are separate. Current native detail also records the login limiter at 25/25 branches and the text-index migration at 22/29 (75.86%). This does not establish deployment-wide or exhaustive interleaving coverage.

## Scope, gate and remaining limitations

Native backend LCOV covers 62 files and frontend 25. Exact unhit outcomes remain in those genuine files; no huge HTML tree or reconstructed summary is shipped. Lower-coverage reset/email/UI paths remain visible in the native data. Pure-unit-only vs integration branch contribution is not separately provided.

Fresh Sonar analysis **a5c1e10e-2804-49f7-801b-4dc55722eaf0** completed **2026-11-03 06:28:03 UTC / 11:58:03 IST** and reports **82.3% overall branch coverage** under its own definitions. The actual gate is PASS with **75% new-code combined coverage**, **0% new duplication**, and `ignoredConditions=true`; the owner-confirmed small-change exemption remains fully disclosed. No claim of reaching the 80% combined new-code threshold is made.

Commit **942cf9ed65099441b30c704a388fd882f0a1d876** is copied in the supplied Git record, with only untracked evidence in supplied Git status; SCM publishing was disabled during the scan. The owner confirms 594/594 backend and 122/122 frontend passes, but the execution log/machine-readable test results have not been supplied. No test suite counts, durations or skip counts are fabricated. See [verification](NFR005_SONARQUBE_VERIFICATION.md) and [provenance](part3-evidence/nfr005-main-a5c1e10e/provenance-assessment.json) for those independent-review qualifications.
