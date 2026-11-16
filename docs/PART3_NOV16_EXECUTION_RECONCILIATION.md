# Part 3 — 16 November 2026 evidence reconciliation for PR #99

**Context:** Team 1, Collaborative Study Material & Quiz Platform. This file documents a review of **new test evidence** collected in `TEAM1-FINAL-REVIEW.zip` and successful GitHub Actions runs for PR #99. It is not a rerun of every test and does not amend the submitted SRS/SAD/STP criteria. The PR was merged as `0267e50238240905f9d98df08b7c1d4abd52f59f`. The final PR head was `d4afa40ff0676679a1f89182169dbf34a035288e`.

## Reconciled original 121-case totals

| Status | Before (12 Nov) | After (16 Nov) |
|---|---:|---:|
| Pass | 111 | **114** |
| Fail | 0 | **0** |
| Partially verified / blocked | 7 | **7** |
| Not Run | 3 | **0** |
| **Total** | **121** | **121** |

Three cases are newly marked **Pass**: **TC-PERF-02, TC-REL-01, TC-SEC-05**. The four previously not-run/blocked authentication/profile cases are **Partially Verified**, not presumed to satisfy the exact original inputs/UI/negative-operation oracles. TC-PERF-01, TC-PORT-01 and TC-AVL-01 stay Partially Verified.

## New recorded execution evidence

| Evidence | Actual recorded result | Scope / caveat |
|---|---|---|
| `redacted-full-check.log` | `npm run check` exit 0: backend **594/594**, frontend **132/132**, Vite production build success | Local Node 24 / npm 11 execution supplied with final review |
| `gateway-final-edge.log` | Browser registration 201, duplicate registration 409, profile PATCH 200, admin grant/revoke 200, permitted upload 201, denied upload 403, quiz create/attempt/history/score, non-retake 409, delete 204; exit 0 | Original exact malicious-name and display-header oracles not all asserted |
| `gateway-final-mail-browser.log` | Password reset delivery, expiry, one-use, old-password rejection, new-password login; exit 0 | Disposable Mailpit adapter |
| `compose-nfr-evidence/load.log` and `stp-summary.json` | k6 100 VUs over 10 min, HTTP resource p95 **14 ms**, attempt POST p95 **262.37 ms**; **49,802/49,802 checks**, HTTP req failures **0/106,817**, no 5xx; exit 0 | HTTP resource timings, not full browser paint; Docker Desktop reference-hardware parity unverified |
| `compose-nfr-evidence/reliability-before.log`, `reliability-after.log` | Original HTTP 201 baseline survives API restart; 100 unique concurrent HTTP 201 submissions persisted | 100 batch + 1 separate baseline, exactly as in log |
| `gateway-final-tls-check.log` | HTTP 301; verified HTTPS/HSTS; TLS 1.2/1.3 accepted and TLS 1.0/1.1 rejected; exit 0 | Runtime protocol checks; testssl.sh/sslscan command not independently recorded |
| `compose-portability-stp-retry.log` | Edge 157, Brave 157, Playwright Firefox 153, WebKit 26.5 PASS; Chrome-for-Testing launch FAIL | Real Safari and latest-two-version matrix not recorded |
| NFR-003 original ZIP and independent audit | **2,880/2,880** healthy probes, zero missed/late | Canonical extra safeguard monitor FAIL and faculty approval still unresolved; not a new 24-h execution |

## GitHub Actions on final PR #99 head `d4afa40`

| Workflow | Result / link |
|---|---|
| Main CI (lint, tests, build) | [SUCCESS](https://github.com/bharat06-co/SE-Level-3-Collaborative-Study-Material-Quiz-Platform/actions/runs/43916256681) |
| SEC-004 browser security | [SUCCESS](https://github.com/bharat06-co/SE-Level-3-Collaborative-Study-Material-Quiz-Platform/actions/runs/43916256797) |
| SEC-005 TLS/HTTPS | [SUCCESS](https://github.com/bharat06-co/SE-Level-3-Collaborative-Study-Material-Quiz-Platform/actions/runs/43916256650) |
| NFR-006 browser compatibility | [SUCCESS](https://github.com/bharat06-co/SE-Level-3-Collaborative-Study-Material-Quiz-Platform/actions/runs/43916256663) |

**Qualification:** Passing automated jobs does not guarantee the original manual Safari/version matrix, acceptance-hardware equivalence, or faculty agreed 24-hour window. The historical source logs remain intact in the supplied ZIP and their names are identified above. This documentation update neither changes source/test code nor claims an additional executed run.
