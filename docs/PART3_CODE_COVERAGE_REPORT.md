# Part 3 - NFR-005 Code Coverage Report

**Fresh supplied NFR-005 verification: PASS for all five technical acceptance criteria; ready for independent review with the qualifications below.** Commit **`942cf9ed65099441b30c704a388fd882f0a1d876`** is confirmed by the copied Git record and associated with this run by the owner. The scan itself has SCM publishing disabled and does not embed that revision SHA. Test totals **594 backend + 122 frontend = 716 passed** are **owner-confirmed**, not independently verified execution results in this package. No historical scan or Jest summary is substituted.

## Authentic fresh inputs and independent calculation

Source inputs are the supplied **server-native-lcov.info** and **client-native-lcov.info**, not historical reports. They contain 62 backend and 25 frontend file records. LCOV detailed DA/FN/FNDA/BRDA records reconcile with every per-file LF/LH/FNF/FNH/BRF/BRH declaration. Exact summed counters follow; percentages truncate to two decimals, matching the reported Jest/Istanbul figures.

| Workspace | Executable lines | Line % | Branch outcomes | Branch % | Functions | Function % |
|---|---|---|---|---|---|---|
| server | 1547/1617 | 95.67 | 940/1120 | 83.92 | 324/339 | 95.57 |
| client | 757/906 | 83.55 | 700/872 | 80.27 | 251/302 | 83.11 |

Statement coverage is **not available from LCOV**. No old statement value, synthetic JSON summary or coverage-final.json is created. Line/function/branch values above are independently derived; the 594/122 passing test counts remain owner-confirmed.

## NFR-005 / TC-MNT-01 required core services

| Required backend service | Executable lines | Line % | Branch outcomes | Branch % | Functions | Function % |
|---|---|---|---|---|---|---|
| `server/src/modules/auth/auth.service.js` | 124/134 | 92.53 | 76/87 | 87.35 | 16/17 | 94.11 |
| `server/src/modules/materials/material.service.js` | 243/257 | 94.55 | 196/229 | 85.58 | 35/38 | 92.10 |
| `server/src/modules/quizzes/quiz.service.js` | 59/60 | 98.33 | 50/54 | 92.59 | 20/20 | 100.00 |
| `server/src/modules/attempts/attempt.service.js` | 18/18 | 100.00 | 15/15 | 100.00 | 4/4 | 100.00 |
| `server/src/modules/attempts/scoring.service.js` | 34/34 | 100.00 | 49/49 | 100.00 | 8/8 | 100.00 |

Full module groups: authentication **240/266 (90.22%)**, materials **472/497 (94.96%)**, quizzes **118/119 (99.15%)**, attempts/scoring **152/152 (100%)** executable lines. Every required service and module group passes the >=70% line criterion. Totals are summed covered/total counters, not averages of percentages. No per-file 70% guarantee is invented.

## Remaining measured gaps

| Included LCOV file below 70% lines | Covered/total | Line % |
|---|---|---|
| `server/src/modules/auth/password-reset.email.js` | 3/8 | 37.50 |
| `server/src/modules/auth/password-reset.repository.js` | 5/9 | 55.55 |
| `server/src/modules/materials/index.js` | 0/2 | 0.00 |
| `client/src/features/auth/ForgotPasswordPage.jsx` | 0/18 | 0.00 |
| `client/src/features/auth/ResetPasswordPage.jsx` | 0/31 | 0.00 |
| `client/src/features/auth/auth.js` | 0/4 | 0.00 |
| `client/src/features/quizzes/QuizAuthoringPage.jsx` | 57/86 | 66.27 |

Included files with zero/low hits remain visible. Native LCOV has no bootstrap/database/logger/main records for the previously excluded plumbing; the fresh configuration itself is not supplied, so collection rules are not inferred beyond the actual file set. Sonar's exported production scope is wider and includes 97 file measures. Coverage combines whichever tests generated the genuine LCOV; pure-unit-only coverage is not separately identified.

## Genuine Sonar import and source provenance

Backend native SHA256: `e368563d058d6d364ec20d0164482b0ff308d3c62f41749904048afa36f268b3`. Frontend native SHA256: `1b7eebe4a8b23e5fea870c0fce235630a3da7ccfba69a61214295ab332831a91`. Both match [the fresh scanner invocation](part3-evidence/nfr005-main-a5c1e10e/sonar-execution.json). [Original SF mapping](part3-evidence/nfr005-main-a5c1e10e/lcov-source-mapping.json) reproduces the supplied normalized scanner inputs exactly; all non-SF records are identical. The fresh [scanner excerpts](part3-evidence/nfr005-main-a5c1e10e/scanner-excerpts.json) name both imported paths. [Per-file Sonar measures](part3-evidence/nfr005-main-a5c1e10e/sonar-file-measures.json) corroborate the core-service imports.

Fresh Sonar analysis **a5c1e10e-2804-49f7-801b-4dc55722eaf0** has overall **89.7% line**, **82.3% branch**, **86.7% combined** coverage. Different executable-line/combined-condition definitions explain the difference from LCOV/Jest workspace metrics. Sonar new-code combined coverage remains **75%**, with the disclosed small-change exemption; it is not an 80% achievement.

Commit **942cf9ed65099441b30c704a388fd882f0a1d876** is supported by the supplied Git record and owner-associated run, related PR #93. SCM publishing was disabled; no scan-time source-hash attestation or embedded revision is supplied. These limits and the owner-confirmed test totals are preserved in [provenance assessment](part3-evidence/nfr005-main-a5c1e10e/provenance-assessment.json). No prior local scan or source snapshot is substituted.
