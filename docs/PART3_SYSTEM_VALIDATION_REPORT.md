# Part 3 — System Validation Report

**Project:** Collaborative Study Material & Quiz Platform  
**Course:** UE24CS341A · Team 1  
**Original faculty testing period:** 2–6 November 2026  
**Consolidated through:** 12 November 2026 (later NFR-003/004 observations dated separately)

## 1. Purpose and method

This report consolidates existing system/integration/browser testing with genuine later acceptance measurements. Original requirements and expected results remain those in SRS v1.2 / STP v1.0. It does not assert that every originally planned test was executed. The accompanying [121-case updated test register](PART3_UPDATED_TEST_CASES.md) preserves original IDs, procedures and pass/blocked/not-run dispositions.

The baseline used real Express routes, MongoDB-backed integration tests, the React client and isolated local browser fixtures. Later availability used the real backend, MongoDB, nginx HTTPS and a detached monitor on one Windows/WSL laptop; usability used a disposable local app with five first-time participants. These are test environments, not externally observed production hosting.

## 2. System validation results

| Test / requirement | Procedure and evidence | Recorded result | Interpretation |
|---|---|---|---|
| TC-AVL-01 / NFR-003 | 24-hour HTTPS GET `/api/v1/health` through real application and MongoDB; 30-second monotonic schedule, 2,880 slots | **2,880/2,880 healthy; 100% sampled availability; 0 missed/late slots** | Quantitative 99% target met. Monitor's **canonical status FAIL** due to added 1-second clock-integrity safeguard; `complete_window=false`. Faculty-agreed start and acceptance not obtained. **Partially verified**, not unconditional full acceptance |
| TC-UX-01 / NFR-004 | Observer-recorded five first-time human attempts; task: login → DBMS normalisation material → related quiz → result | **5/5 reached result unaided; 3–5 min each** | Original ≥4/5 human threshold met according to supplied observer sheet. Three missing exact participant timestamps disclosed. Manual sign-in errors observed; broader automated inline form groups **10/10 reported passed** |
| TC-MNT-01 / NFR-005 | Existing Sonar gate and native LCOV; 5 priority core services | **PASS**; 0 blocker/critical; all core services >70% line coverage | Sonar has 8 major and 1 minor open, and uses documented small-change exemption; see existing verification |
| TC-PORT-01 / NFR-006 | Existing vendor/engine/browser smoke evidence | **Partially verified** | Full specified browser/version/path acceptance still pending; administrative issue closure is not test pass |
| Functional/API + browser | Historical auth, material, quiz, attempt, moderation, profile/contract integration and browser procedures | Multiple genuine passes as recorded in original Part 3 baseline | Not equal to complete STP sign-off; see case register |
| Performance, reliability, TLS/security staging | Original staging/load/concurrency and transport/security procedures | **Blocked or not run** where listed in STP register | No fabricated load measurements, certificate results or vulnerability-scan completion |

### NFR-003: independent 24-hour record

Scheduled UTC: **2026-11-07 20:26:10.193 → 2026-11-08 20:26:10.193**. Recorded UTC end **20:26:10.197**, 4 ms after scheduled wall-clock end. Monotonic elapsed **86,408.276 seconds**, exceeding 24 hours. All 2,880 ordered slot records present, with exactly one HTTP 200 success per scheduled slot, database/process checks true, zero skipped/missed slots. Independent audit verified **29/29 ZIP ledger hashes and 12/12 original-run hashes**. The implementation also recorded ~8.273 seconds of accumulated wall/monotonic divergence; its supplementary strict monitor rule set `status=FAIL` and `clock_anomaly=true`. These fields remain unmodified. Numerical sampled availability is valid as reported; full original acceptance also required faculty agreement, which is not documented. See [final run report](NFR003_24H_FINAL_REPORT.md), [independent audit](NFR003_INDEPENDENT_AUDIT.md) and [original evidence ZIP](part3-evidence/NFR003_24H_FINAL_EVIDENCE.zip).

### NFR-004: real human sessions and inline validation

Observer-reported date **12 November 2026**; participants **P1–P5** completed unaided in **4, 4, 3, 5 and 3 minutes**; reported scores **3/3, 2/3, 3/3, 2/3, 3/3**. Median time 4 minutes. No assistance was recorded. P1/P2 clock times were recorded without AM/PM; P3–P5 exact clock start/finish times were not recorded. The manual sign-in validation demonstrated **“Email is required.”** and **“Password is required.”** below corresponding fields. Codex-produced final report states **10/10 automated validation groups passed on 9 November 2026**, but the current two-file handoff did not include its underlying saved JSON; this figure is therefore **reported**, not independently recalculated here. See [observer sheet](NFR004_PARTICIPANT_OBSERVATION_SHEET.md), [final usability report](NFR004_FINAL_USABILITY_REPORT.md), and existing [test protocol](NFR004_USABILITY.md). No participant screenshots are required for this record.

## 3. Testing coverage and quality

The existing [Unit Test Report](PART3_UNIT_TEST_REPORT.md), [Code Coverage Report](PART3_CODE_COVERAGE_REPORT.md) and [Branch Coverage Report](PART3_BRANCH_COVERAGE_REPORT.md) are **already present on main** and should not be replaced by these supplementary documents.

| Component | Owner-confirmed tests | Line coverage | Branch coverage |
|---|---:|---:|---:|
| Backend | 594 | **95.67%** (1,547/1,617) | **83.92%** (940/1,120) |
| Frontend | 122 | **83.55%** (757/906) | **80.27%** (700/872) |
| **Total** | **716 tests** | No separately validated combined percentage | No separately validated combined percentage |

Coverage percentages are independently backed by LCOV counts in the existing reports. The original NFR-005 package labels the Jest execution total owner-confirmed, not independently verified from its exported source. A subsequent supplied PowerShell log from 12 November independently displays the same **594 + 122** locally; it is not substituted as provenance for the earlier Sonar run. Some frontend tests emit non-fatal React `act(...)` warnings.

## 4. Original STP disposition

| Original test cases | Pass | Fail | Blocked or partially verified | Not run |
|---:|---:|---:|---:|---:|
| **121** | **111** | **0** | **7** | **3** |

This aggregate is the historical 121-case register reconciled only for TC-MNT-01 and TC-UX-01. It does **not** treat NFR-003 as an unconditional pass, because its canonical monitoring verdict remains failed and faculty agreement is missing. Do not equate 0 recorded failing STP case dispositions with a claim that all STP exit criteria were satisfied.

## 5. Known limitations and deviations

- System-testing evidence combines a 2–6 November baseline with separately dated 8–9 November availability and 12 November usability work; completion **within the original testing week** is not claimed.
- The team-initiated availability test used the **same host** for application and monitoring; it is not independently measured production uptime. Faculty approval/agreement was **not obtained**. The additional one-second clock safeguard invalidated the original monitor verdict, despite all probe responses being healthy.
- Real five-person NFR-004 results are observer-recorded rather than witnessed independently by this report; three participants lack exact start/end clock times, and the provided final document reports (rather than supplies the raw JSON for) its automated browser validation run.
- NFR-006 full required version/path matrix remains **Partially Verified — Documented Deviation, Approval Pending** despite the administrative closure of issue #38.
- Some original STP staging performance, concurrency reliability, TLS/security scans and UI procedures remain blocked/not run, as individually enumerated in the updated test register.
- The Sonar quality gate passed with its **small-change exemption**; lower-severity findings remain open. Do not state that all findings are resolved.

## 6. Conclusion

The completed system tests substantiate **100% sampled API/database health (2,880/2,880)** and the human-usability threshold (**5/5 unaided**, as recorded), plus passing Sonar and strong code/branch coverage. The project does **not** have unconditional sign-off against all 121 original STP cases; blocked or not-run cases and documented deviations remain. These are disclosed rather than silently recorded as passes.

**Supporting documents:** [Updated Test Case Document](PART3_UPDATED_TEST_CASES.md) · [NFR-003 report](NFR003_24H_FINAL_REPORT.md) · [NFR-003 independent audit](NFR003_INDEPENDENT_AUDIT.md) · [NFR-004 observations](NFR004_PARTICIPANT_OBSERVATION_SHEET.md) · [NFR-004 final report](NFR004_FINAL_USABILITY_REPORT.md) · [NFR-005 Sonar verification](NFR005_SONARQUBE_VERIFICATION.md) · [NFR-006 browser status](NFR006_BROWSER_COMPATIBILITY.md).
