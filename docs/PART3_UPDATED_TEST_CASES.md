# Part 3 — Updated Test Case Document

**Project:** Collaborative Study Material & Quiz Platform · UE24CS341A · Team 1  
**Update:** 12 November 2026 · Based on original SRS v1.2 / STP v1.0, 121 cases.

## Reconciliation and scope

| Original STP cases | Pass | Fail | Blocked / partially verified | Not run |
|---:|---:|---:|---:|---:|
| **121** | **111** | **0** | **7** | **3** |

This register preserves the original test IDs, preconditions, inputs, procedures and expected outcomes. Historical local baseline results come from the previously generated Part 3 register and are not new executions. The Nov 12 update changes only TC-MNT-01 (Sonar), TC-UX-01 (five-person usability), TC-AVL-01 (genuine 24-hour data with explicit technical/administrative limitation), and the descriptive qualification for TC-PORT-01. The 121-case total and original criteria are unchanged.

**Interpretation:** 'Pass' means the cited evidence supports the listed test at its stated scope; it is not a blanket production or faculty sign-off. TC-AVL-01 is kept in **Blocked / partially verified** because the canonical monitor result is FAIL and faculty agreement was not obtained, even though all numeric availability measurements passed. TC-PORT-01 also remains partly verified. Other blocked/not-run procedures are not silently upgraded. This file covers the required test-case updates; the supplementary P3-PROFILE-EMAIL-01 is not counted in 121.

## Tests updated after the historical baseline

| ID | Current result | Source |
|---|---|---|
| TC-MNT-01 | **Pass** | Existing [Sonar report](NFR005_SONARQUBE_VERIFICATION.md) and coverage reports |
| TC-UX-01 | **Pass** (5/5 observer-recorded human completions; 10/10 reported automated validation groups) | [Observation sheet](NFR004_PARTICIPANT_OBSERVATION_SHEET.md), [usability report](NFR004_FINAL_USABILITY_REPORT.md) |
| TC-AVL-01 | **Partially verified / Blocked** (2,880/2,880; monitor FAIL on clock safeguard; faculty acceptance pending) | [Final evaluation](NFR003_24H_FINAL_REPORT.md), [audit](NFR003_INDEPENDENT_AUDIT.md) |
| TC-PORT-01 | **Partially verified / Blocked** (full browser matrix outstanding) | [Browser report](NFR006_BROWSER_COMPATIBILITY.md) |

## Full original STP case-by-case register

## TC-AUTH-01 — Register with valid details

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.41; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-001 |
| Test type | Integration |
| Preconditions | Email not registered |
| Input / data | name "Riya S", email riya@pes.edu, pwd [valid synthetic password] |
| Execution steps | POST /auth/register |
| Expected result (unchanged) | 201; role = student, contributor = false; passwordHash starts with $2b$ |
| Implementation | server/src/modules/auth |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/auth.integration.test.js; server/tests/auth.service.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 auth/RBAC; Sprint 2 profile/reset integration. Preserve endpoint, rate-limit and status discrepancies. |

## TC-AUTH-02 — Reject duplicate email (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.41; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-001 |
| Test type | Integration |
| Preconditions | riya@pes.edu exists |
| Input / data | RIYA@pes.edu |
| Execution steps | Register again with same email (upper-case variant) |
| Expected result (unchanged) | 409 EMAIL_TAKEN; no second user stored |
| Implementation | server/src/modules/auth |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/auth.integration.test.js; server/tests/auth.service.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 auth/RBAC; Sprint 2 profile/reset integration. Preserve endpoint, rate-limit and status discrepancies. |

## TC-AUTH-03 — Password and name boundaries

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.41; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-001 |
| Test type | Unit (BVA) |
| Preconditions | — |
| Input / data | pwd 7 chars / 8 chars; "abcdefgh" (no digit); name 1 / 2 / 60 / 61 chars |
| Execution steps | Validate schema with boundary values |
| Expected result (unchanged) | 7 chars, no digit, name 1 or 61 → 400; 8-char [valid synthetic password], name 2 and 60 → valid |
| Implementation | server/src/modules/auth |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/auth.integration.test.js; server/tests/auth.service.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 auth/RBAC; Sprint 2 profile/reset integration. Preserve endpoint, rate-limit and status discrepancies. |

## TC-AUTH-04 — Login with correct credentials

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.41; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-002 |
| Test type | Integration |
| Preconditions | User exists |
| Input / data | riya@pes.edu / [valid synthetic password] |
| Execution steps | POST /auth/login |
| Expected result (unchanged) | 200; JWT exp − iat = 900 s; refresh cookie HttpOnly, Secure, SameSite=Strict |
| Implementation | server/src/modules/auth |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/auth.integration.test.js; server/tests/auth.service.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 auth/RBAC; Sprint 2 profile/reset integration. Preserve endpoint, rate-limit and status discrepancies. |

## TC-AUTH-05 — Login with wrong password / unknown email (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.41; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-002 |
| Test type | Integration |
| Preconditions | User exists |
| Input / data | wrong pwd; nobody@pes.edu |
| Execution steps | Login twice with bad inputs |
| Expected result (unchanged) | Both 401 INVALID_CREDENTIALS with identical message |
| Implementation | server/src/modules/auth |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/auth.integration.test.js; server/tests/auth.service.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 auth/RBAC; Sprint 2 profile/reset integration. Preserve endpoint, rate-limit and status discrepancies. |

## TC-AUTH-06 — Logout revokes refresh token

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.41; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-003, SEC-002 |
| Test type | Integration |
| Preconditions | Logged in |
| Input / data | Old refresh token |
| Execution steps | POST /auth/logout → POST /auth/refresh with old cookie |
| Expected result (unchanged) | Logout 204; refresh 401 TOKEN_INVALID |
| Implementation | server/src/modules/auth |
| Actual result | {"logoutStatus": 204, "refreshStatus": 401, "refreshCode": "TOKEN_INVALID"} |
| Status | Pass |
| Executable files | scripts/part3-stp-conformance.cjs; server/tests/auth.integration.test.js; server/tests/loginRateLimit.test.js |
| Evidence | [part3-evidence/stp-conformance.json](part3-evidence/stp-conformance.json) |
| Sprint / Part 3 change | Part 3 authorized correction: submitted logout/profile contract restored; name-only updates; failed-login limit. Original expected result unchanged. |

## TC-AUTH-07 — Student blocked from admin endpoint

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.41; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-004, SEC-003 |
| Test type | Integration |
| Preconditions | Student token |
| Input / data | {"role":"admin"} |
| Execution steps | PATCH /admin/users/{id}/role |
| Expected result (unchanged) | 403 FORBIDDEN; role unchanged |
| Implementation | server/src/modules/auth |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/auth.integration.test.js; server/tests/auth.service.test.js; server/tests/material.auth.integration.test.js; server/tests/role.permission.matrix.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 auth/RBAC; Sprint 2 profile/reset integration. Preserve endpoint, rate-limit and status discrepancies. |

## TC-AUTH-08 — Admin grants contributor privilege

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.41; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-004 |
| Test type | System |
| Preconditions | Admin + student accounts |
| Input / data | Valid 1 MB PDF |
| Execution steps | Admin sets contributor = true → student uploads a PDF |
| Expected result (unchanged) | Grant 200; upload 201 (was 403 before grant) |
| Implementation | server/src/modules/auth |
| Actual result | API grant/upload lifecycle passed in material.auth and permission-matrix suites; no admin role-management UI route exists for the original system procedure. |
| Status | Not Run |
| Executable files | server/tests/auth.integration.test.js; server/tests/auth.service.test.js; server/tests/material.auth.integration.test.js; server/tests/role.permission.matrix.integration.test.js; server/tests/material.auth.integration.test.js; server/tests/role.permission.matrix.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 auth/RBAC; Sprint 2 profile/reset integration. Preserve endpoint, rate-limit and status discrepancies. |

## TC-AUTH-09 — Edit own profile; cannot change role

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.41; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-005 |
| Test type | Integration |
| Preconditions | Student logged in |
| Input / data | {"name":"Riya Sharma"}; {"role":"admin"} |
| Execution steps | PATCH /users/me twice |
| Expected result (unchanged) | First 200 with new name; second 400; stored role still student |
| Implementation | server/src/modules/auth |
| Actual result | {"nameStatus": 200, "roleStatus": 400, "nameUpdated": true, "role": "student"} |
| Status | Pass |
| Executable files | scripts/part3-stp-conformance.cjs; server/tests/profile.integration.test.js |
| Evidence | [part3-evidence/stp-conformance.json](part3-evidence/stp-conformance.json) |
| Sprint / Part 3 change | Part 3 authorized correction: submitted logout/profile contract restored; name-only updates; failed-login limit. Original expected result unchanged. |

## TC-AUTH-10 — Password reset link is single-use and expires

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.41; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-006 |
| Test type | Integration |
| Preconditions | User exists; mail stub |
| Input / data | New pwd [valid synthetic new password] |
| Execution steps | Forgot → reset with token → reuse token → reset with 31- min-old token |
| Expected result (unchanged) | Reset 200; old pwd fails, new works; reuse 400; expired 400; old refresh tokens revoked |
| Implementation | server/src/modules/auth |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/password-reset.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 auth/RBAC; Sprint 2 profile/reset integration. Preserve endpoint, rate-limit and status discrepancies. |

## TC-AUTH-11 — Admin revokes contributor privilege (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.41; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-004 |
| Test type | System |
| Preconditions | Admin + student with contributor = true; student holds an access token issued before the revoke |
| Input / data | Valid 1 MB PDF |
| Execution steps | Admin sets contributor = false → student uploads a PDF with the same (still unexpired) token |
| Expected result (unchanged) | Revoke 200; upload 403 FORBIDDEN; nothing stored (no DB record, no file on volume) |
| Implementation | server/src/modules/auth |
| Actual result | API revocation with the same JWT passed; original system procedure is not independently demonstrated in a role-management UI. |
| Status | Not Run |
| Executable files | server/tests/auth.integration.test.js; server/tests/auth.service.test.js; server/tests/material.auth.integration.test.js; server/tests/role.permission.matrix.integration.test.js; server/tests/material.auth.integration.test.js; server/tests/role.permission.matrix.integration.test.js; server/tests/material.auth.integration.test.js; server/tests/role.permission.matrix.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 auth/RBAC; Sprint 2 profile/reset integration. Preserve endpoint, rate-limit and status discrepancies. |

## TC-AUTH-12 — Refresh rotates the token

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.41; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-002 |
| Test type | Integration |
| Preconditions | Logged in; valid refresh cookie |
| Input / data | Current refresh cookie |
| Execution steps | POST /auth/refresh → reuse the old cookie |
| Expected result (unchanged) | First call 200 with new access token and new cookie; reuse of old cookie → 401 TOKEN_INVALID |
| Implementation | server/src/modules/auth |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/auth.integration.test.js; server/tests/auth.service.test.js; server/tests/material.auth.integration.test.js; server/tests/role.permission.matrix.integration.test.js; server/tests/material.auth.integration.test.js; server/tests/role.permission.matrix.integration.test.js; server/tests/material.auth.integration.test.js; server/tests/role.permission.matrix.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 auth/RBAC; Sprint 2 profile/reset integration. Preserve endpoint, rate-limit and status discrepancies. |

## TC-AUTH-13 — Login rate limit (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.41; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-002 |
| Test type | Integration |
| Preconditions | User exists |
| Input / data | riya@pes.edu / wrong pwd × 11 |
| Execution steps | Send 11 wrong-password logins within 15 min from one IP |
| Expected result (unchanged) | Attempts 1–10 → 401; attempt 11 → 429 RATE_LIMITED; correct login after the window → 200 |
| Implementation | server/src/modules/auth |
| Actual result | {"statuses": [401, 401, 401, 401, 401, 401, 401, 401, 401, 401, 429], "recoveryStatus": 200}. Injected wall-clock function advanced exactly 15 minutes; no 15-minute elapsed-time observation claimed. |
| Status | Pass |
| Executable files | scripts/part3-stp-conformance.cjs; server/tests/auth.integration.test.js; server/tests/loginRateLimit.test.js |
| Evidence | [part3-evidence/stp-conformance.json](part3-evidence/stp-conformance.json) |
| Sprint / Part 3 change | Part 3 authorized correction: submitted logout/profile contract restored; name-only updates; failed-login limit. Original expected result unchanged. |

## TC-AUTH-14 — View own profile

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.41; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-005 |
| Test type | Integration |
| Preconditions | Student logged in |
| Input / data | — |
| Execution steps | GET /users/me |
| Expected result (unchanged) | 200 with name, email, role, contributor; no passwordHash or token fields in the JSON |
| Implementation | server/src/modules/auth |
| Actual result | {"status": 200, "safeFieldsOnly": true} |
| Status | Pass |
| Executable files | scripts/part3-stp-conformance.cjs; server/tests/profile.integration.test.js |
| Evidence | [part3-evidence/stp-conformance.json](part3-evidence/stp-conformance.json) |
| Sprint / Part 3 change | Part 3 authorized correction: submitted logout/profile contract restored; name-only updates; failed-login limit. Original expected result unchanged. |

## TC-AUTH-15 — Profile name boundaries

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.42; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-005 |
| Test type | Unit (BVA) |
| Preconditions | — |
| Input / data | name 1 / 2 / 60 / 61 chars |
| Execution steps | Validate profile schema |
| Expected result (unchanged) | 1 and 61 → invalid; 2 and 60 → valid |
| Implementation | server/src/modules/auth |
| Actual result | {"lengths": [1, 2, 60, 61], "statuses": [400, 200, 200, 400], "note": "Same profile validation tested via implemented API boundary rather than a separate exported schema."} |
| Status | Pass |
| Executable files | server/tests/profile.integration.test.js; scripts/part3-stp-additional.cjs |
| Evidence | [part3-evidence/stp-additional.json](part3-evidence/stp-additional.json) |
| Sprint / Part 3 change | Sprint 1 auth/RBAC; Sprint 2 profile/reset integration. Preserve endpoint, rate-limit and status discrepancies. |

## TC-AUTH-16 — Cannot change email or contributor via profile (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.42; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-005 |
| Test type | Integration |
| Preconditions | Student logged in |
| Input / data | {"email":"x@pes.edu"}; {"contributor":true} |
| Execution steps | PATCH /users/me twice |
| Expected result (unchanged) | Both 400 VALIDATION_ERROR; stored email and contributor unchanged |
| Implementation | server/src/modules/auth |
| Actual result | {"status": 400, "emailChanged": false, "contributorStatus": 400} |
| Status | Pass |
| Executable files | scripts/part3-stp-conformance.cjs; server/tests/profile.integration.test.js |
| Evidence | [part3-evidence/stp-conformance.json](part3-evidence/stp-conformance.json) |
| Sprint / Part 3 change | Part 3 authorized correction: submitted logout/profile contract restored; name-only updates; failed-login limit. Original expected result unchanged. |

## TC-AUTH-17 — Profile requires a valid token (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.42; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-005 |
| Test type | Integration |
| Preconditions | — |
| Input / data | — |
| Execution steps | GET and PATCH /users/me without a token |
| Expected result (unchanged) | 401 UNAUTHENTICATED for both; nothing changed |
| Implementation | server/src/modules/auth |
| Actual result | {"get": 401, "patch": 401, "unchanged": true} |
| Status | Pass |
| Executable files | scripts/part3-stp-conformance.cjs; server/tests/profile.integration.test.js |
| Evidence | [part3-evidence/stp-conformance.json](part3-evidence/stp-conformance.json) |
| Sprint / Part 3 change | Part 3 authorized correction: submitted logout/profile contract restored; name-only updates; failed-login limit. Original expected result unchanged. |

## TC-AUTH-18 — Operator and script input in name (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.42; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-005 |
| Test type | Integration |
| Preconditions | Student logged in |
| Input / data | {"name":{"$gt":""}}; name "<script>alert(1)</script>" |
| Execution steps | PATCH /users/me twice; open profile page |
| Expected result (unchanged) | Object → 400 VALIDATION_ERROR; script name shown as plain text, no script runs |
| Implementation | server/src/modules/auth |
| Actual result | Canonical API path is restored; complete profile-page script-name rendering procedure remains Not Run because no profile UI route is implemented. |
| Status | Not Run |
| Executable files | server/tests/profile.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 auth/RBAC; Sprint 2 profile/reset integration. Preserve endpoint, rate-limit and status discrepancies. |

## TC-AUTH-19 — Empty profile update (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.42; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-005 |
| Test type | Integration |
| Preconditions | Student logged in |
| Input / data | {} |
| Execution steps | PATCH /users/me with empty body |
| Expected result (unchanged) | 400 VALIDATION_ERROR; profile unchanged |
| Implementation | server/src/modules/auth |
| Actual result | {"status": 400, "unchanged": true} |
| Status | Pass |
| Executable files | scripts/part3-stp-conformance.cjs; server/tests/profile.integration.test.js |
| Evidence | [part3-evidence/stp-conformance.json](part3-evidence/stp-conformance.json) |
| Sprint / Part 3 change | Part 3 authorized correction: submitted logout/profile contract restored; name-only updates; failed-login limit. Original expected result unchanged. |

## TC-AUTH-20 — Edit profile in the UI

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.42; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-005 |
| Test type | System |
| Preconditions | Student logged in |
| Input / data | "R"; "Riya Sharma" |
| Execution steps | Profile page → type 1-char name → then valid name → save → reload |
| Expected result (unchanged) | Inline error before submit for "R"; after save and reload header shows "Riya Sharma" |
| Implementation | server/src/modules/auth |
| Actual result | Profile-edit UI route is absent from AppRoutes.jsx; API implementation alone cannot execute this system case. |
| Status | Blocked |
| Executable files | server/tests/profile.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 auth/RBAC; Sprint 2 profile/reset integration. Preserve endpoint, rate-limit and status discrepancies. |

## TC-AUTH-21 — Admin changes role to educator

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.42; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-004 |
| Test type | Integration |
| Preconditions | Admin + student accounts |
| Input / data | {"role":"educator"} |
| Execution steps | PATCH /admin/users/{id}/role → user creates a quiz → user attempts a quiz |
| Expected result (unchanged) | 200; quiz create 201; attempt 403 (educators cannot attempt) |
| Implementation | server/src/modules/auth |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/admin.test.js; server/tests/role.permission.matrix.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 auth/RBAC; Sprint 2 profile/reset integration. Preserve endpoint, rate-limit and status discrepancies. |

## TC-AUTH-22 — Invalid role or privilege value (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.42; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-004 |
| Test type | Integration |
| Preconditions | Admin logged in |
| Input / data | {"role":"superuser"}; {"contributor":"yes"} |
| Execution steps | PATCH /admin/users/{id}/role twice |
| Expected result (unchanged) | Both 400 VALIDATION_ERROR; stored role and contributor unchanged |
| Implementation | server/src/modules/auth |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/admin.test.js; server/tests/role.permission.matrix.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 auth/RBAC; Sprint 2 profile/reset integration. Preserve endpoint, rate-limit and status discrepancies. |

## TC-AUTH-23 — Admin lists users

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.42; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-004 |
| Test type | Integration |
| Preconditions | Admin; 4 seeded accounts |
| Input / data | — |
| Execution steps | GET /admin/users as admin, then as student |
| Expected result (unchanged) | Admin 200 with role and contributor per user, no passwordHash; student 403 |
| Implementation | server/src/modules/auth |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/admin.test.js; server/tests/role.permission.matrix.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 auth/RBAC; Sprint 2 profile/reset integration. Preserve endpoint, rate-limit and status discrepancies. |

## TC-AUTH-24 — Unknown or malformed user ID (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.42; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-004 |
| Test type | Integration |
| Preconditions | Admin logged in |
| Input / data | Random valid ObjectId; "abc" |
| Execution steps | PATCH /admin/users/{id}/role |
| Expected result (unchanged) | 404 NOT_FOUND; 400 VALIDATION_ERROR |
| Implementation | server/src/modules/auth |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/admin.test.js; server/tests/role.permission.matrix.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 auth/RBAC; Sprint 2 profile/reset integration. Preserve endpoint, rate-limit and status discrepancies. |

## TC-AUTH-25 — Role change applies on the next request

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.42; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-004 |
| Test type | Integration |
| Preconditions | Educator E holds an unexpired access token |
| Input / data | Valid quiz body |
| Execution steps | Admin sets E to student → E creates a quiz with the same token |
| Expected result (unchanged) | Role change 200; quiz create 403 FORBIDDEN (role re-read from DB, not the JWT) |
| Implementation | server/src/modules/auth |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/admin.test.js; server/tests/role.permission.matrix.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 auth/RBAC; Sprint 2 profile/reset integration. Preserve endpoint, rate-limit and status discrepancies. |

## TC-MAT-01 — Contributor uploads material with tags

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.42; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-010, FR-011 |
| Test type | Integration |
| Preconditions | Contributor logged in |
| Input / data | 2 MB PDF; title "ER Diagrams"; category Notes; topic dbms; tags "ER, dbms, ER" |
| Execution steps | POST /materials (multipart) |
| Expected result (unchanged) | 201; visibility private; tags stored ["er","dbms"] |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.service.test.js; server/tests/material.routes.test.js; server/tests/material.auth.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-02 — Plain student cannot upload (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.42; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-010 |
| Test type | Integration |
| Preconditions | Student (no contributor) |
| Input / data | Valid PDF |
| Execution steps | POST /materials |
| Expected result (unchanged) | 403 FORBIDDEN; nothing stored |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.service.test.js; server/tests/material.routes.test.js; server/tests/material.auth.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-03 — Required metadata missing (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.42; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-010 |
| Test type | Integration |
| Preconditions | Contributor |
| Input / data | title "" / "ab" |
| Execution steps | Upload without title; with 2- char title |
| Expected result (unchanged) | 400 VALIDATION_ERROR naming field title |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.service.test.js; server/tests/material.routes.test.js; server/tests/material.auth.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-04 — Search with keyword + tag filter

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.42; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-012 |
| Test type | Integration |
| Preconditions | 5 seeded items (1 private, 1 hidden) |
| Input / data | — |
| Execution steps | GET /materials? q=normalisation&tag=dbms |
| Expected result (unchanged) | Only visible items matching both filters; private and hidden items absent; page size 20 |
| Implementation | server/src/modules/materials |
| Actual result | {"status": 200, "total": 1, "limit": 20, "privateHiddenAndNonmatchingExcluded": true} |
| Status | Pass |
| Executable files | server/tests/material.service.test.js; server/tests/material.routes.test.js; server/tests/material.auth.integration.test.js; scripts/part3-stp-additional.cjs |
| Evidence | [part3-evidence/stp-additional.json](part3-evidence/stp-additional.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-05 — Visibility private / shared / public

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.42; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-013 |
| Test type | Integration |
| Preconditions | Owner A, users B and C |
| Input / data | sharedWith=[B] |
| Execution steps | Set shared with B → B and C fetch; set public → C fetches |
| Expected result (unchanged) | Shared: B 200, C 404; public: C 200 |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.service.test.js; server/tests/material.routes.test.js; server/tests/material.auth.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-06 — Rate and comment; rating bounds

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.42; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-014 |
| Test type | Integration |
| Preconditions | Public material |
| Input / data | value 4→2, 0, 6; comment "Helpful" |
| Execution steps | PUT rating 4, then 2 by same user; rate 0 and 6; add comment |
| Expected result (unchanged) | One rating stored (2); 0 and 6 → 400; comment stored as separate document |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.rating.comment.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-07 — Owner edit creates revision

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.43; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-015, FR-018 |
| Test type | Integration |
| Preconditions | Material v0 by owner |
| Input / data | title "ER Diagrams v2" |
| Execution steps | PATCH title and tags |
| Expected result (unchanged) | 200; revision versionNo 1 holds old title and tags; list newest first |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.revisions.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-08 — Non-owner cannot edit (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.43; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-018, SEC-007 |
| Test type | Integration |
| Preconditions | Material owned by A; B is a contributor |
| Input / data | {"title":"hacked"} |
| Execution steps | B sends PATCH /materials/{id} |
| Expected result (unchanged) | 403; no revision created; admin doing the same → 200 |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.revisions.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-09 — Educator uploads study material

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.43; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-010 |
| Test type | Integration |
| Preconditions | Educator logged in (role = educator, contributor = false) |
| Input / data | 2 MB PDF; title "Normal Forms"; category Notes; topic dbms |
| Execution steps | POST /materials (multipart) |
| Expected result (unchanged) | 201; ownerId = educator; visibility private; material listed for its owner |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.service.test.js; server/tests/material.routes.test.js; server/tests/material.auth.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-10 — Rights confirmation required (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.43; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-010 |
| Test type | Integration |
| Preconditions | Contributor logged in |
| Input / data | Valid PDF; rightsConfirmed missing / false |
| Execution steps | POST /materials without rightsConfirmed (BR-5) |
| Expected result (unchanged) | 400 VALIDATION_ERROR naming rightsConfirmed; nothing stored |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.service.test.js; server/tests/material.routes.test.js; server/tests/material.auth.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-11 — Tag count and length boundaries

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.43; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-011 |
| Test type | Unit (BVA) |
| Preconditions | — |
| Input / data | 0, 1, 10, 11 tags; tag of 30 / 31 chars |
| Execution steps | Validate tags |
| Expected result (unchanged) | 0, 11 tags and 31 chars → invalid; 1, 10 tags and 30 chars → valid |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.service.test.js; server/tests/material.routes.test.js; server/tests/material.auth.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-12 — Title, category and topic rules

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.43; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-010 |
| Test type | Unit (BVA) |
| Preconditions | — |
| Input / data | title 3 / 120 / 121 chars; category or topic missing |
| Execution steps | Validate material metadata |
| Expected result (unchanged) | 3 and 120 → valid; 121 → invalid; missing category or topic → invalid |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.service.test.js; server/tests/material.routes.test.js; server/tests/material.auth.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-13 — Filter by category

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.43; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-012 |
| Test type | Integration |
| Preconditions | 8 visible items: 5 Notes, 3 Slides |
| Input / data | — |
| Execution steps | GET /materials? category=Notes |
| Expected result (unchanged) | Exactly the 5 Notes items |
| Implementation | server/src/modules/materials |
| Actual result | {"status": 200, "notesReturned": 5, "seeded": 8} |
| Status | Pass |
| Executable files | server/tests/material.service.test.js; server/tests/material.routes.test.js; server/tests/material.auth.integration.test.js; scripts/part3-stp-additional.cjs |
| Evidence | [part3-evidence/stp-additional.json](part3-evidence/stp-additional.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-14 — Pagination at 20 per page

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.43; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-012 |
| Test type | Integration (BVA) |
| Preconditions | 45 visible items |
| Input / data | — |
| Execution steps | GET /materials?page=1, 2, 3, 4 |
| Expected result (unchanged) | 20, 20, 5 and 0 items; total = 45 in every response |
| Implementation | server/src/modules/materials |
| Actual result | {"sizes": [20, 20, 5, 0], "totals": [45, 45, 45, 45], "uniqueIds": 45} |
| Status | Pass |
| Executable files | server/tests/material.service.test.js; server/tests/material.routes.test.js; server/tests/material.auth.integration.test.js; scripts/part3-stp-additional.cjs |
| Evidence | [part3-evidence/stp-additional.json](part3-evidence/stp-additional.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-15 — Search with no matches

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.43; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-012 |
| Test type | Integration |
| Preconditions | Seeded material |
| Input / data | — |
| Execution steps | GET /materials?q=xyzzy |
| Expected result (unchanged) | 200 with empty list and total 0; UI shows "No material found" |
| Implementation | server/src/modules/materials |
| Actual result | No-match search returned an empty list and visible empty-state message (current wording: No materials match these filters.). |
| Status | Pass |
| Executable files | server/tests/material.service.test.js; server/tests/material.routes.test.js; server/tests/material.auth.integration.test.js; scripts/part3-system-browser.cjs |
| Evidence | [part3-evidence/system-browser/results.json](part3-evidence/system-browser/results.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-16 — Operator in query parameter (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.43; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-012 |
| Test type | Integration |
| Preconditions | Seeded material incl. private items |
| Input / data | — |
| Execution steps | GET /materials?tag[$ne]=x |
| Expected result (unchanged) | 400 VALIDATION_ERROR; no unfiltered or private items returned |
| Implementation | server/src/modules/materials |
| Actual result | {"status": 400, "code": "VALIDATION_ERROR", "noItemsReturned": true} |
| Status | Pass |
| Executable files | server/tests/material.service.test.js; server/tests/material.routes.test.js; server/tests/material.auth.integration.test.js; scripts/part3-stp-additional.cjs |
| Evidence | [part3-evidence/stp-additional.json](part3-evidence/stp-additional.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-17 — Private item hidden from detail and download

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.43; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-013 |
| Test type | Integration |
| Preconditions | Private material owned by A |
| Input / data | — |
| Execution steps | B calls GET /materials/{id} and /materials/{id}/file; then A does the same |
| Expected result (unchanged) | B: 404 for both; A: 200 for both |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.service.test.js; server/tests/material.routes.test.js; server/tests/material.auth.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-18 — Shared item appears in search only for listed users

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.43; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-012, FR-013 |
| Test type | Integration |
| Preconditions | Material shared with B; C not listed |
| Input / data | — |
| Execution steps | B and C search by its title |
| Expected result (unchanged) | B sees the item; C does not |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.service.test.js; server/tests/material.routes.test.js; server/tests/material.auth.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-19 — Search and open material in the UI

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.43; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-012 |
| Test type | System (E2E) |
| Preconditions | Seeded material |
| Input / data | "normalisation", tag dbms |
| Execution steps | Library → keyword + tag filter → open detail → download |
| Expected result (unchanged) | Results update without reload; detail shows file, average rating and comments; download succeeds |
| Implementation | server/src/modules/materials |
| Actual result | Keyword+dbms tag search opened detail; rating/comments visible; downloaded PDF bytes verified. |
| Status | Pass |
| Executable files | server/tests/material.service.test.js; server/tests/material.routes.test.js; server/tests/material.auth.integration.test.js; scripts/part3-system-browser.cjs |
| Evidence | [part3-evidence/system-browser/results.json](part3-evidence/system-browser/results.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-20 — Average rating calculation

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.43; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-014 |
| Test type | Unit |
| Preconditions | — |
| Input / data | Ratings 5, 4, 2; re-rate 2 → 5 |
| Execution steps | Compute ratingAvg; then one user re-rates |
| Expected result (unchanged) | ratingAvg 3.67, then 4.67 |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.rating.comment.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-21 — Comment length boundaries

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.43; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-014 |
| Test type | Unit (BVA) |
| Preconditions | — |
| Input / data | 0 / 1 / 1000 / 1001 chars |
| Execution steps | Validate comment |
| Expected result (unchanged) | 0 and 1001 → invalid; 1 and 1000 → valid |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.rating.comment.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-22 — Non-integer rating (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.43; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-014 |
| Test type | Integration |
| Preconditions | Public material |
| Input / data | value 3.5; value "four" |
| Execution steps | PUT /materials/{id}/rating twice |
| Expected result (unchanged) | Both 400 VALIDATION_ERROR; no rating stored |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.rating.comment.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-23 — Cannot rate or comment on hidden-from-me material (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.43; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-014, FR-013 |
| Test type | Integration |
| Preconditions | Private material owned by A |
| Input / data | value 4; "Nice" |
| Execution steps | B rates and comments |
| Expected result (unchanged) | 404 for both; nothing stored |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.rating.comment.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-24 — List comments

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.43; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-014 |
| Test type | Integration |
| Preconditions | Public material with 3 comments |
| Input / data | — |
| Execution steps | GET /materials/{id}/comments |
| Expected result (unchanged) | 3 items, each with author, content and createdAt, ordered by createdAt |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.rating.comment.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-25 — Rate and comment in the UI

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.44; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-014 |
| Test type | System |
| Preconditions | Public material; student logged in |
| Input / data | "Very clear notes" |
| Execution steps | Click 4 stars; post a comment; try an empty comment |
| Expected result (unchanged) | Average and new comment appear without reload; empty comment shows inline error |
| Implementation | server/src/modules/materials |
| Actual result | Rating 4 saved; comment appeared without navigation; empty comment showed inline error. |
| Status | Pass |
| Executable files | server/tests/material.rating.comment.integration.test.js; scripts/part3-system-browser.cjs |
| Evidence | [part3-evidence/system-browser/results.json](part3-evidence/system-browser/results.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-26 — Several edits give sequential revisions

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.44; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-015 |
| Test type | Integration |
| Preconditions | Material v0 by owner |
| Input / data | "v1", "v2", "v3" |
| Execution steps | Owner edits title 3 times → GET /materials/{id}/revisions |
| Expected result (unchanged) | versionNo 1, 2, 3; listed newest first; each holds the state before that edit |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.revisions.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-27 — Non-owner cannot view revisions (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.44; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-015 |
| Test type | Integration |
| Preconditions | Material owned by A with 1 revision |
| Input / data | — |
| Execution steps | B and then admin call GET /materials/{id}/revisions |
| Expected result (unchanged) | B 403; admin 200 |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.revisions.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-28 — File replacement keeps old file in revision

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.44; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-015, FR-018 |
| Test type | Integration |
| Preconditions | Material with file f1.pdf |
| Input / data | Valid 1 MB PDF |
| Execution steps | Owner PATCH with new file f2.pdf |
| Expected result (unchanged) | 200; revision holds old fileUrl (f1); download returns f2 |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.revisions.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MAT-29 — Restrict visibility again

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.44; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-013 |
| Test type | Integration |
| Preconditions | Public material; B in sharedWith |
| Input / data | — |
| Execution steps | Owner sets private, then shared with [] → B and C fetch |
| Expected result (unchanged) | C 404 after private; B 404 after removal from sharedWith |
| Implementation | server/src/modules/materials |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.service.test.js; server/tests/material.routes.test.js; server/tests/material.auth.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 upload/search/sharing; Sprint 2 metadata/file revisions, ratings/comments and deletion. DEV-07/08 clarify moderation/revisions. |

## TC-MOD-01 — Report hides material

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.44; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-016 |
| Test type | Integration |
| Preconditions | Public material; student logged in |
| Input / data | reason "copyright" |
| Execution steps | POST /materials/{id}/reports |
| Expected result (unchanged) | 201 status open; material missing from search for others; second open report by same user → 409 |
| Implementation | server/src/modules/moderation |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/moderation.integration.test.js; server/tests/report.service.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 reporting/moderation; DEV-07 defines hidden-item reporting and uphold/dismiss semantics. |

## TC-MOD-02 — Admin dismisses report

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.44; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-017 |
| Test type | Integration |
| Preconditions | Open report |
| Input / data | — |
| Execution steps | PATCH /admin/reports/{id} {"decision":"dismiss"} |
| Expected result (unchanged) | status dismissed; reviewerId = admin; material visible again |
| Implementation | server/src/modules/moderation |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/moderation.integration.test.js; server/tests/report.service.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 reporting/moderation; DEV-07 defines hidden-item reporting and uphold/dismiss semantics. |

## TC-MOD-03 — Admin upholds report

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.44; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-017 |
| Test type | Integration |
| Preconditions | Open report |
| Input / data | — |
| Execution steps | PATCH /admin/reports/{id} {"decision":"uphold"} |
| Expected result (unchanged) | status actioned; material stays hidden |
| Implementation | server/src/modules/moderation |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/moderation.integration.test.js; server/tests/report.service.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 reporting/moderation; DEV-07 defines hidden-item reporting and uphold/dismiss semantics. |

## TC-MOD-04 — Non-admin cannot review (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.44; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-017, SEC-003 |
| Test type | Integration |
| Preconditions | Educator token |
| Input / data | dismiss |
| Execution steps | PATCH /admin/reports/{id} |
| Expected result (unchanged) | 403; report still open |
| Implementation | server/src/modules/moderation |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/moderation.integration.test.js; server/tests/report.service.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 reporting/moderation; DEV-07 defines hidden-item reporting and uphold/dismiss semantics. |

## TC-MOD-05 — Missing or invalid reason (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.44; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-016 |
| Test type | Integration |
| Preconditions | Public material; student logged in |
| Input / data | no reason; reason "boring" |
| Execution steps | POST /materials/{id}/reports twice |
| Expected result (unchanged) | Both 400 VALIDATION_ERROR; no report; material still visible |
| Implementation | server/src/modules/moderation |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/moderation.integration.test.js; server/tests/report.service.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 reporting/moderation; DEV-07 defines hidden-item reporting and uphold/dismiss semantics. |

## TC-MOD-06 — Contributor and educator can report

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.44; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-016 |
| Test type | Integration |
| Preconditions | Public material |
| Input / data | reason "spam" |
| Execution steps | Contributor, then educator, POST a report |
| Expected result (unchanged) | 201 for both; two open reports stored |
| Implementation | server/src/modules/moderation |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/moderation.integration.test.js; server/tests/report.service.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 reporting/moderation; DEV-07 defines hidden-item reporting and uphold/dismiss semantics. |

## TC-MOD-07 — Admin cannot report (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.44; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-016 |
| Test type | Integration |
| Preconditions | Admin logged in |
| Input / data | reason "spam" |
| Execution steps | POST /materials/{id}/reports |
| Expected result (unchanged) | 403 FORBIDDEN; no report |
| Implementation | server/src/modules/moderation |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/moderation.integration.test.js; server/tests/report.service.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 reporting/moderation; DEV-07 defines hidden-item reporting and uphold/dismiss semantics. |

## TC-MOD-08 — Report unknown or private material (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.44; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-016 |
| Test type | Integration |
| Preconditions | Private material owned by A |
| Input / data | reason "copyright" |
| Execution steps | B reports a random ID, then A’s private item |
| Expected result (unchanged) | 404 for both; no report |
| Implementation | server/src/modules/moderation |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/moderation.integration.test.js; server/tests/report.service.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 reporting/moderation; DEV-07 defines hidden-item reporting and uphold/dismiss semantics. |

## TC-MOD-09 — Can report again after review

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.44; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-016 |
| Test type | Integration |
| Preconditions | Report by S dismissed |
| Input / data | reason "copyright" |
| Execution steps | S reports the same material again |
| Expected result (unchanged) | 201 (one-open-report rule only blocks open reports) |
| Implementation | server/src/modules/moderation |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/moderation.integration.test.js; server/tests/report.service.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 reporting/moderation; DEV-07 defines hidden-item reporting and uphold/dismiss semantics. |

## TC-MOD-10 — Report rate limit (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.44; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-016 |
| Test type | Integration |
| Preconditions | Student; many public materials |
| Input / data | Limit + 1 reports |
| Execution steps | Submit reports quickly past the configured limit |
| Expected result (unchanged) | Over the limit → 429 RATE_LIMITED; earlier reports stored |
| Implementation | server/src/modules/moderation |
| Actual result | {"statuses": [201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 429], "limit": 10} |
| Status | Pass |
| Executable files | server/tests/moderation.integration.test.js; server/tests/report.service.test.js; scripts/part3-stp-additional.cjs |
| Evidence | [part3-evidence/stp-additional.json](part3-evidence/stp-additional.json) |
| Sprint / Part 3 change | Sprint 2 reporting/moderation; DEV-07 defines hidden-item reporting and uphold/dismiss semantics. |

## TC-MOD-11 — Report from the UI

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.44; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-016 |
| Test type | System |
| Preconditions | Public material; students S1, S2 |
| Input / data | reason "copyright" |
| Execution steps | S1 clicks Report → reason + note → submit; S2 opens Library |
| Expected result (unchanged) | S1 sees confirmation; material absent from S2’s Library |
| Implementation | server/src/modules/moderation |
| Actual result | Student report confirmed; second student library excluded reported material. |
| Status | Pass |
| Executable files | server/tests/moderation.integration.test.js; server/tests/report.service.test.js; scripts/part3-system-browser.cjs |
| Evidence | [part3-evidence/system-browser/results.json](part3-evidence/system-browser/results.json) |
| Sprint / Part 3 change | Sprint 2 reporting/moderation; DEV-07 defines hidden-item reporting and uphold/dismiss semantics. |

## TC-MOD-12 — Review queue oldest first

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.44; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-017 |
| Test type | Integration |
| Preconditions | 3 open reports, 1 dismissed |
| Input / data | — |
| Execution steps | GET /admin/reports? status=open |
| Expected result (unchanged) | Only the 3 open reports, oldest first, each with material title and reason |
| Implementation | server/src/modules/moderation |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/moderation.integration.test.js; server/tests/report.service.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 reporting/moderation; DEV-07 defines hidden-item reporting and uphold/dismiss semantics. |

## TC-MOD-13 — Invalid decision or report ID (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.45; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-017 |
| Test type | Integration |
| Preconditions | Admin; open report |
| Input / data | {"decision":"delete"}; random ID |
| Execution steps | PATCH /admin/reports/{id} |
| Expected result (unchanged) | 400 VALIDATION_ERROR; 404 NOT_FOUND; report still open |
| Implementation | server/src/modules/moderation |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/moderation.integration.test.js; server/tests/report.service.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 reporting/moderation; DEV-07 defines hidden-item reporting and uphold/dismiss semantics. |

## TC-MOD-14 — Student cannot see review queue (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.45; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-017 |
| Test type | Integration |
| Preconditions | Student token |
| Input / data | — |
| Execution steps | GET /admin/reports? status=open |
| Expected result (unchanged) | 403 FORBIDDEN |
| Implementation | server/src/modules/moderation |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/moderation.integration.test.js; server/tests/report.service.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 reporting/moderation; DEV-07 defines hidden-item reporting and uphold/dismiss semantics. |

## TC-MOD-15 — Report decision is audited

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.45; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-017 |
| Test type | Integration |
| Preconditions | Open report |
| Input / data | — |
| Execution steps | Admin dismisses → check logs |
| Expected result (unchanged) | Audit log entry with reportId, decision and admin userId |
| Implementation | server/src/modules/moderation |
| Actual result | {"status": 200, "event": "report.decision", "decision": "dismiss", "reportIdAndAdminUserIdVerified": true} |
| Status | Pass |
| Executable files | server/tests/moderation.integration.test.js; server/tests/report.service.test.js; scripts/part3-stp-additional.cjs |
| Evidence | [part3-evidence/stp-additional.json](part3-evidence/stp-additional.json) |
| Sprint / Part 3 change | Sprint 2 reporting/moderation; DEV-07 defines hidden-item reporting and uphold/dismiss semantics. |

## TC-MOD-16 — Admin review in the console

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.45; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-017 |
| Test type | System (E2E) |
| Preconditions | Open report on material M |
| Input / data | — |
| Execution steps | Admin Console → Reports → Dismiss; student opens Library |
| Expected result (unchanged) | Report leaves the queue; M visible to the student again |
| Implementation | server/src/modules/moderation |
| Actual result | Admin UI dismissed report; report left open queue and student library displayed material again. |
| Status | Pass |
| Executable files | server/tests/moderation.integration.test.js; server/tests/report.service.test.js; scripts/part3-system-browser.cjs |
| Evidence | [part3-evidence/system-browser/results.json](part3-evidence/system-browser/results.json) |
| Sprint / Part 3 change | Sprint 2 reporting/moderation; DEV-07 defines hidden-item reporting and uphold/dismiss semantics. |

## TC-QZ-01 — Create quiz with MCQ and T/F

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.45; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-020, FR-021 |
| Test type | Integration |
| Preconditions | Educator logged in |
| Input / data | 1 MCQ (4 options, key 1) + 1 T/F (key true); topic dbms |
| Execution steps | POST /quizzes |
| Expected result (unchanged) | 201; status draft; 2 questions saved |
| Implementation | server/src/modules/quizzes |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/quiz.test.js; server/tests/quiz.auth.db.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 authoring/RBAC; Sprint 2 topic linkage and lifecycle integration. |

## TC-QZ-02 — MCQ option count boundaries

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.45; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-022 |
| Test type | Unit (BVA) |
| Preconditions | — |
| Input / data | options 1, 2, 6, 7 |
| Execution steps | Validate questions |
| Expected result (unchanged) | 1 and 7 → invalid; 2 and 6 → valid |
| Implementation | server/src/modules/quizzes |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/quiz.test.js; server/tests/quiz.auth.db.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 authoring/RBAC; Sprint 2 topic linkage and lifecycle integration. |

## TC-QZ-03 — Bad answer key or unsupported type (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.45; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-021, FR-022 |
| Test type | Unit |
| Preconditions | — |
| Input / data | MCQ no key; key 5 with 4 options; T/F key "yes"; type "essay" |
| Execution steps | Validate questions |
| Expected result (unchanged) | All invalid with reason (400 VALIDATION_ERROR) |
| Implementation | server/src/modules/quizzes |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/quiz.test.js; server/tests/quiz.auth.db.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 authoring/RBAC; Sprint 2 topic linkage and lifecycle integration. |

## TC-QZ-04 — Publish gate blocks empty quiz

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.45; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-025 |
| Test type | Integration |
| Preconditions | Draft quiz with 0 questions |
| Input / data | — |
| Execution steps | POST /quizzes/{id}/publish |
| Expected result (unchanged) | 422 QUIZ_NOT_PUBLISHABLE; still draft |
| Implementation | server/src/modules/quizzes |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/quiz.test.js; server/tests/quiz.auth.db.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 authoring/RBAC; Sprint 2 topic linkage and lifecycle integration. |

## TC-QZ-05 — Publish, then unpublish

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.45; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-023, BR-3 |
| Test type | System |
| Preconditions | Valid draft quiz |
| Input / data | — |
| Execution steps | Publish → student opens → unpublish → student submits |
| Expected result (unchanged) | Published visible; after unpublish submit → 404 QUIZ_NOT_AVAILABLE |
| Implementation | server/src/modules/quizzes |
| Actual result | Author UI published a valid draft; student opened it; author UI unpublished it; student submission returned 404 QUIZ_NOT_AVAILABLE. Equivalent authorized contributor used as author. |
| Status | Pass |
| Executable files | server/tests/quiz.test.js; server/tests/quiz.auth.db.integration.test.js; scripts/part3-system-browser.cjs |
| Evidence | [part3-evidence/system-browser/results.json](part3-evidence/system-browser/results.json) |
| Sprint / Part 3 change | Sprint 1 authoring/RBAC; Sprint 2 topic linkage and lifecycle integration. |

## TC-QZ-06 — Non-author cannot edit / publish (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.45; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-023, BR-1, SEC-007 |
| Test type | Integration |
| Preconditions | Quiz by educator E1; contributor C1 |
| Input / data | — |
| Execution steps | C1 sends PUT and publish |
| Expected result (unchanged) | 403 for both; admin → 200 |
| Implementation | server/src/modules/quizzes |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/quiz.test.js; server/tests/quiz.auth.db.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 authoring/RBAC; Sprint 2 topic linkage and lifecycle integration. |

## TC-QZ-07 — Topic linkage

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.45; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-024 |
| Test type | Integration |
| Preconditions | 2 published dbms quizzes, 1 os quiz |
| Input / data | — |
| Execution steps | GET /quizzes?topic=DBMS; open a dbms material page |
| Expected result (unchanged) | Exactly the 2 dbms quizzes (case- insensitive) on both |
| Implementation | server/src/modules/quizzes |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/quiz.test.js; server/tests/quiz.auth.db.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 authoring/RBAC; Sprint 2 topic linkage and lifecycle integration. |

## TC-QZ-08 — Contributor creates a quiz

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.45; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-020 |
| Test type | Integration |
| Preconditions | Student with contributor = true logged in |
| Input / data | title "DBMS Basics"; topic dbms; 1 T/F question (key true) |
| Execution steps | POST /quizzes |
| Expected result (unchanged) | 201; status draft; authorId = contributor |
| Implementation | server/src/modules/quizzes |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/quiz.test.js; server/tests/quiz.auth.db.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 authoring/RBAC; Sprint 2 topic linkage and lifecycle integration. |

## TC-LB-01 — Rank ties and best score

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.45; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-035 |
| Test type | Integration |
| Preconditions | Students A, B, C with attempts |
| Input / data | A: 5 then 8; B: 8; C: 6 (max 10) |
| Execution steps | GET /leaderboard?quizId=… |
| Expected result (unchanged) | A rank 1 (8), B rank 1 (8), C rank 3 (6) |
| Implementation | server/src/modules/analytics |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/leaderboard.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 best-score/topic leaderboard with competition ties. |

## TC-LB-02 — Topic leaderboard

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.45; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-035 |
| Test type | Integration |
| Preconditions | 2 published quizzes in topic dbms |
| Input / data | A: 80 %, 60 %; B: 100 % on one quiz |
| Execution steps | GET /leaderboard? topic=dbms |
| Expected result (unchanged) | A 140 → rank 1; B 100 → rank 2 |
| Implementation | server/src/modules/analytics |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/leaderboard.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 best-score/topic leaderboard with competition ties. |

## TC-LB-03 — Unpublished quiz excluded from topic leaderboard

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.45; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-035 |
| Test type | Integration |
| Preconditions | Topic dbms: Q1 published, Q2 unpublished after attempts |
| Input / data | A: Q1 50 %, Q2 100 % |
| Execution steps | GET /leaderboard? topic=dbms |
| Expected result (unchanged) | A ranking score 50 (Q2 ignored) |
| Implementation | server/src/modules/analytics |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/leaderboard.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 best-score/topic leaderboard with competition ties. |

## TC-LB-04 — Competition ranking

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.45; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-035 |
| Test type | Unit |
| Preconditions | — |
| Input / data | [9, 7, 7, 7, 5] |
| Execution steps | rank(scores) |
| Expected result (unchanged) | Ranks [1, 2, 2, 2, 5] |
| Implementation | server/src/modules/analytics |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/leaderboard.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 best-score/topic leaderboard with competition ties. |

## TC-LB-05 — Quiz with no attempts

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.45; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-035 |
| Test type | Integration |
| Preconditions | Published quiz, 0 attempts |
| Input / data | — |
| Execution steps | GET /leaderboard?quizId=… |
| Expected result (unchanged) | 200 with empty list |
| Implementation | server/src/modules/analytics |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/leaderboard.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 best-score/topic leaderboard with competition ties. |

## TC-LB-06 — Missing or bad parameters (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.45; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-035 |
| Test type | Integration |
| Preconditions | — |
| Input / data | — |
| Execution steps | GET /leaderboard with no params; quizId "abc"; unknown quizId |
| Expected result (unchanged) | 400 VALIDATION_ERROR; 400; 404 NOT_FOUND |
| Implementation | server/src/modules/analytics |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/leaderboard.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 best-score/topic leaderboard with competition ties. |

## TC-LB-07 — Retake improves rank

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.46; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-035, BR-2 |
| Test type | Integration |
| Preconditions | allowRetake = true; A 4/10, B 6/10 |
| Input / data | — |
| Execution steps | A retakes and scores 9 → GET leaderboard |
| Expected result (unchanged) | A rank 1 (9), B rank 2 (6) |
| Implementation | server/src/modules/analytics |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/leaderboard.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 best-score/topic leaderboard with competition ties. |

## TC-LB-08 — All roles can view; login required

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.46; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-035 |
| Test type | Integration |
| Preconditions | Quiz with attempts |
| Input / data | — |
| Execution steps | GET leaderboard as student, contributor, educator, admin and without token |
| Expected result (unchanged) | Same list (200) for all four roles; no token → 401 |
| Implementation | server/src/modules/analytics |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/leaderboard.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 best-score/topic leaderboard with competition ties. |

## TC-LB-09 — Leaderboard in the UI

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.46; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-035 |
| Test type | System |
| Preconditions | Quiz and topic with attempts |
| Input / data | — |
| Execution steps | Open Leaderboard → switch quiz / topic |
| Expected result (unchanged) | Ranked list with ties shown as 1, 1, 3; switching updates without reload |
| Implementation | server/src/modules/analytics |
| Actual result | Current real Chromium/API/MongoDB run rendered competition ties 1,1,3 and switched to topic ranks/scores 140,100,60. New current results and screenshot are separate from the historical Chrome artifact. |
| Status | Pass |
| Executable files | server/tests/leaderboard.integration.test.js; scripts/part3-leaderboard-browser.cjs |
| Evidence | [part3-evidence/leaderboard-browser/results.json](part3-evidence/leaderboard-browser/results.json) |
| Sprint / Part 3 change | Sprint 2 best-score/topic leaderboard with competition ties. |

## TC-ATT-01 — Student attempts published quiz

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.46; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-030 |
| Test type | Integration |
| Preconditions | Published quiz, 3 questions |
| Input / data | All answered |
| Execution steps | POST /quizzes/{id}/attempts |
| Expected result (unchanged) | 201 with attemptId, score, maxScore 3 |
| Implementation | server/src/modules/attempts |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/attempt.test.js; server/tests/attempt.auth.integration.test.js; server/tests/attempt.history.progress.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 authoritative scoring/no-retake guard; Sprint 2 immutable history and access controls (DEV-05). |

## TC-ATT-02 — Draft quiz cannot be attempted (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.46; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-030, BR-3 |
| Test type | Integration |
| Preconditions | Draft quiz |
| Input / data | — |
| Execution steps | POST attempt |
| Expected result (unchanged) | 404 QUIZ_NOT_AVAILABLE; no record |
| Implementation | server/src/modules/attempts |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/attempt.test.js; server/tests/attempt.auth.integration.test.js; server/tests/attempt.history.progress.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 authoritative scoring/no-retake guard; Sprint 2 immutable history and access controls (DEV-05). |

## TC-ATT-03 — Retake disabled

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.46; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-030, BR-2 |
| Test type | Integration |
| Preconditions | allowRetake = false; 1 attempt exists |
| Input / data | — |
| Execution steps | Submit again (also 2 parallel first submits) |
| Expected result (unchanged) | 409 RETAKE_NOT_ALLOWED; parallel case stores exactly 1 attempt |
| Implementation | server/src/modules/attempts |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/attempt.test.js; server/tests/attempt.auth.integration.test.js; server/tests/attempt.history.progress.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 authoritative scoring/no-retake guard; Sprint 2 immutable history and access controls (DEV-05). |

## TC-ATT-04 — Mixed answers scoring

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.46; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-031 |
| Test type | Unit |
| Preconditions | — |
| Input / data | 5 questions: 3 correct, 1 wrong, 1 missing |
| Execution steps | score(questions, answers) |
| Expected result (unchanged) | score 3, maxScore 5; isCorrect flags T,T,T,F,F |
| Implementation | server/src/modules/attempts |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/attempt.test.js; server/tests/attempt.auth.integration.test.js; server/tests/attempt.history.progress.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 authoritative scoring/no-retake guard; Sprint 2 immutable history and access controls (DEV-05). |

## TC-ATT-05 — All blank and all correct

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.46; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-031 |
| Test type | Unit (BVA) |
| Preconditions | — |
| Input / data | none answered; all correct |
| Execution steps | score() twice |
| Expected result (unchanged) | 0 / 5 and 5 / 5 |
| Implementation | server/src/modules/attempts |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/attempt.test.js; server/tests/attempt.auth.integration.test.js; server/tests/attempt.history.progress.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 authoritative scoring/no-retake guard; Sprint 2 immutable history and access controls (DEV-05). |

## TC-ATT-06 — Invalid answers and client score (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.46; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-031, SEC-004 |
| Test type | Integration |
| Preconditions | Published quiz |
| Input / data | — |
| Execution steps | Submit unknown questionId; T/F response 3; include "score": 99 |
| Expected result (unchanged) | 400 for invalid answers; with valid answers, stored score is server- computed (99 ignored) |
| Implementation | server/src/modules/attempts |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/attempt.test.js; server/tests/attempt.auth.integration.test.js; server/tests/attempt.history.progress.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 authoritative scoring/no-retake guard; Sprint 2 immutable history and access controls (DEV-05). |

## TC-ATT-07 — Immediate feedback shown

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.46; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-032 |
| Test type | System |
| Preconditions | Published quiz |
| Input / data | 2 correct, 1 wrong |
| Execution steps | Submit in UI |
| Expected result (unchanged) | Result page without reload shows 2/3, per-question marks and correct answers |
| Implementation | server/src/modules/attempts |
| Actual result | 2/3 feedback, two Correct/one Incorrect and all correct answers displayed without navigation. |
| Status | Pass |
| Executable files | server/tests/attempt.test.js; server/tests/attempt.auth.integration.test.js; server/tests/attempt.history.progress.integration.test.js; scripts/part3-system-browser.cjs |
| Evidence | [part3-evidence/system-browser/results.json](part3-evidence/system-browser/results.json) |
| Sprint / Part 3 change | Sprint 1 authoritative scoring/no-retake guard; Sprint 2 immutable history and access controls (DEV-05). |

## TC-ATT-08 — History and privacy

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.46; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-033 |
| Test type | Integration |
| Preconditions | Student S1 has 3 attempts, S2 has 1 |
| Input / data | — |
| Execution steps | S1 GET /attempts/me; S1 GET /attempts/{S2 attempt} |
| Expected result (unchanged) | 3 items newest first with score, date; other student → 403 |
| Implementation | server/src/modules/attempts |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/attempt.test.js; server/tests/attempt.auth.integration.test.js; server/tests/attempt.history.progress.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 authoritative scoring/no-retake guard; Sprint 2 immutable history and access controls (DEV-05). |

## TC-ATT-09 — Educator / admin cannot attempt (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.46; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-030 |
| Test type | Integration |
| Preconditions | Educator token |
| Input / data | — |
| Execution steps | POST attempt |
| Expected result (unchanged) | 403 FORBIDDEN |
| Implementation | server/src/modules/attempts |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/attempt.test.js; server/tests/attempt.auth.integration.test.js; server/tests/attempt.history.progress.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 authoritative scoring/no-retake guard; Sprint 2 immutable history and access controls (DEV-05). |

## TC-ATT-10 — Own attempt detail

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.46; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-033 |
| Test type | Integration |
| Preconditions | Student has 1 attempt |
| Input / data | — |
| Execution steps | GET /attempts/{id} |
| Expected result (unchanged) | 200 with answers, isCorrect per question, score, maxScore, submittedAt |
| Implementation | server/src/modules/attempts |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/attempt.test.js; server/tests/attempt.auth.integration.test.js; server/tests/attempt.history.progress.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 authoritative scoring/no-retake guard; Sprint 2 immutable history and access controls (DEV-05). |

## TC-ATT-11 — Empty history

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.46; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-033 |
| Test type | Integration |
| Preconditions | New student, no attempts |
| Input / data | — |
| Execution steps | GET /attempts/me |
| Expected result (unchanged) | 200 with empty list; UI shows "No attempts yet" |
| Implementation | server/src/modules/attempts |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/attempt.test.js; server/tests/attempt.auth.integration.test.js; server/tests/attempt.history.progress.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 authoritative scoring/no-retake guard; Sprint 2 immutable history and access controls (DEV-05). |

## TC-ATT-12 — History stable after quiz edit

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.46; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-033 |
| Test type | Integration |
| Preconditions | Attempt scored 2/3 |
| Input / data | — |
| Execution steps | Author changes an answer key → student GET /attempts/me |
| Expected result (unchanged) | Attempt still shows 2/3 (stored result, SAD D-3) |
| Implementation | server/src/modules/attempts |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/attempt.test.js; server/tests/attempt.auth.integration.test.js; server/tests/attempt.history.progress.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 1 authoritative scoring/no-retake guard; Sprint 2 immutable history and access controls (DEV-05). |

## TC-ANL-01 — Progress by topic uses best score

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.46; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-034 |
| Test type | Integration |
| Preconditions | Topic dbms: quiz Q1 attempts 40 %, 80 %; Q2 60 % |
| Input / data | — |
| Execution steps | GET /analytics/me/progress |
| Expected result (unchanged) | dbms: quizzesAttempted 2, averageBestPct 70; timeline has 3 points |
| Implementation | server/src/modules/analytics |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/progress.service.test.js; server/tests/attempt.history.progress.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 history/progress dashboard with best-per-quiz aggregates. |

## TC-ANL-02 — Dashboard with no attempts

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.46; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-034 |
| Test type | Integration |
| Preconditions | New student |
| Input / data | — |
| Execution steps | GET /analytics/me/progress |
| Expected result (unchanged) | 200; topics [] and timeline [] |
| Implementation | server/src/modules/analytics |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/progress.service.test.js; server/tests/attempt.history.progress.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 history/progress dashboard with best-per-quiz aggregates. |

## TC-ANL-03 — Several topics

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.46; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-034 |
| Test type | Integration |
| Preconditions | dbms: Q1 80 %; os: Q3 50 % then 100 % |
| Input / data | — |
| Execution steps | GET /analytics/me/progress |
| Expected result (unchanged) | dbms: 1 quiz, average 80; os: 1 quiz, average 100 |
| Implementation | server/src/modules/analytics |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/progress.service.test.js; server/tests/attempt.history.progress.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 history/progress dashboard with best-per-quiz aggregates. |

## TC-ANL-04 — Own data only; educator blocked (negative)

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.47; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-034 |
| Test type | Integration |
| Preconditions | S1 and S2 have attempts |
| Input / data | — |
| Execution steps | S1 GET progress; educator GET progress |
| Expected result (unchanged) | S1 sees only own attempts; educator 403 |
| Implementation | server/src/modules/analytics |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/progress.service.test.js; server/tests/attempt.history.progress.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 history/progress dashboard with best-per-quiz aggregates. |

## TC-ANL-05 — Percentage rounding and timeline order

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.47; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-034 |
| Test type | Unit |
| Preconditions | — |
| Input / data | Best 2/3 and 1/3 in one topic; 3 attempts on different days |
| Execution steps | progress(attempts) |
| Expected result (unchanged) | averageBestPct 50.0; timeline sorted by submittedAt |
| Implementation | server/src/modules/analytics |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/progress.service.test.js; server/tests/attempt.history.progress.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 history/progress dashboard with best-per-quiz aggregates. |

## TC-ANL-06 — Dashboard updates after an attempt

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.47; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | FR-034 |
| Test type | System |
| Preconditions | Student with 1 attempt |
| Input / data | — |
| Execution steps | Attempt another quiz in UI → open My Progress |
| Expected result (unchanged) | New point on the timeline; topic average updated |
| Implementation | server/src/modules/analytics |
| Actual result | Starting from one baseline quiz attempt, another quiz updated the visible dashboard to two quizzes and two timeline points. |
| Status | Pass |
| Executable files | server/tests/progress.service.test.js; server/tests/attempt.history.progress.integration.test.js; scripts/part3-system-browser.cjs |
| Evidence | [part3-evidence/system-browser/results.json](part3-evidence/system-browser/results.json) |
| Sprint / Part 3 change | Sprint 2 history/progress dashboard with best-per-quiz aggregates. |

## TC-PERF-01 — Response time under load

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.47; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | NFR-001 |
| Test type | Performance |
| Preconditions | Staging stack, seeded data |
| Input / data | 100 VUs |
| Execution steps | k6: 100 VUs, 10 min, mix browse/search/attempt |
| Expected result (unchanged) | p95 page ≤ 3 s; p95 POST attempt ≤ 2 s |
| Implementation | scripts |
| Actual result | Docker daemon unavailable; no isolated nginx/API/MongoDB7/k6 100-VU ten-minute run. Required hardware/staging parity not established. |
| Status | Blocked |
| Executable files | Acceptance tooling in System Validation Report |
| Evidence | [PART3_SYSTEM_VALIDATION_REPORT.md](PART3_SYSTEM_VALIDATION_REPORT.md) |
| Sprint / Part 3 change | Sprint 2 acceptance tooling; preserve original thresholds and external acceptance obligations. |

## TC-PERF-02 — 100 concurrent users without errors

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.47; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | NFR-002 |
| Test type | Performance |
| Preconditions | Same run as TC- PERF-01 |
| Input / data | — |
| Execution steps | Check k6 thresholds |
| Expected result (unchanged) | 0 % 5xx; 100 % checks pass |
| Implementation | scripts |
| Actual result | Depends on TC-PERF-01; no current zero-5xx/100%-checks measurement. |
| Status | Blocked |
| Executable files | Acceptance tooling in System Validation Report |
| Evidence | [PART3_SYSTEM_VALIDATION_REPORT.md](PART3_SYSTEM_VALIDATION_REPORT.md) |
| Sprint / Part 3 change | Sprint 2 acceptance tooling; preserve original thresholds and external acceptance obligations. |

## TC-AVL-01 — Availability over 24-h evaluation window

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.47; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | NFR-003 |
| Test type | System |
| Preconditions | Deployed demo stack |
| Input / data | 2,880 probes |
| Execution steps | Uptime probe on /health every 30 s for 24 h |
| Expected result (unchanged) | ≥ 2,852 successful probes (≥ 99 %) |
| Implementation | scripts |
| Actual result | Team-initiated same-host evaluation: 2,880/2,880 genuinely recorded HTTPS application/database health probes healthy; zero missed or late slots; sampled availability 100%. Monotonic 30-second schedule and both end deadlines verified. Canonical monitor output is FAIL (clock anomaly / complete_window false) under a supplementary 1-second safeguard; faculty-agreed start time and formal acceptance absent. Numerical availability demonstrated but original full acceptance remains pending. |
| Status | Blocked |
| Executable files | Acceptance tooling in System Validation Report |
| Evidence | [NFR003_24H_FINAL_REPORT.md](NFR003_24H_FINAL_REPORT.md); [NFR003_INDEPENDENT_AUDIT.md](NFR003_INDEPENDENT_AUDIT.md); [raw evidence ZIP](part3-evidence/NFR003_24H_FINAL_EVIDENCE.zip) |
| Sprint / Part 3 change | Sprint 2 acceptance tooling; preserve original thresholds and external acceptance obligations. |

## TC-UX-01 — First-time users complete a quiz

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.47; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | NFR-004 |
| Test type | Acceptance |
| Preconditions | 5 users new to the app |
| Input / data | Script + observer |
| Execution steps | Task: log in, find dbms quiz, attempt, read result |
| Expected result (unchanged) | ≥ 4 of 5 succeed unaided; inline errors on all forms |
| Implementation | scripts |
| Actual result | Five first-time human participants were recorded as reaching the quiz result screen without substantive assistance (5/5; elapsed times 4, 4, 3, 5, 3 minutes). 10/10 inline-validation browser evidence groups reported passed; observer manually confirmed two required-field errors on the sign-in form. Exact start/end times for P3-P5 unreported. Human observations are observer-recorded, not independently witnessed by this report. |
| Status | Pass |
| Executable files | Acceptance tooling in System Validation Report |
| Evidence | [NFR004_PARTICIPANT_OBSERVATION_SHEET.md](NFR004_PARTICIPANT_OBSERVATION_SHEET.md); [NFR004_FINAL_USABILITY_REPORT.md](NFR004_FINAL_USABILITY_REPORT.md); [NFR004_USABILITY.md](NFR004_USABILITY.md) |
| Sprint / Part 3 change | Sprint 2 acceptance tooling; preserve original thresholds and external acceptance obligations. |

## TC-MNT-01 — Quality gate and coverage

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.47; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | NFR-005 |
| Test type | Static / Unit |
| Preconditions | CI pipeline |
| Input / data | — |
| Execution steps | Run Sonar scan and jest -- coverage |
| Expected result (unchanged) | Gate passed; 0 blocker/critical; line coverage ≥ 70 % on core services |
| Implementation | scripts |
| Actual result | Actual SonarQube gate PASS, 0 blocker/critical issues; core-service line coverage above 70%. Fresh merged-main LCOV independently reconciled; lower-severity findings and small-change new-code coverage exemption explicitly documented. |
| Status | Pass |
| Executable files | Acceptance tooling in System Validation Report |
| Evidence | [NFR005_SONARQUBE_VERIFICATION.md](NFR005_SONARQUBE_VERIFICATION.md); [PART3_CODE_COVERAGE_REPORT.md](PART3_CODE_COVERAGE_REPORT.md); [PART3_BRANCH_COVERAGE_REPORT.md](PART3_BRANCH_COVERAGE_REPORT.md) |
| Sprint / Part 3 change | Sprint 2 acceptance tooling; preserve original thresholds and external acceptance obligations. |

## TC-PORT-01 — Cross-browser smoke

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.47; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | NFR-006 |
| Test type | System (E2E) |
| Preconditions | Staging |
| Input / data | Chrome and Edge (branded channels), Firefox, WebKit; Safari on macOS/iOS if available |
| Execution steps | Playwright login → search → attempt; then manual smoke on real Safari |
| Expected result (unchanged) | All automated runs pass; Safari smoke passes, or is recorded as not available with WebKit as proxy |
| Implementation | scripts |
| Actual result | Existing automated and manual browser evidence is documented, including some branded browsers and real Safari initial smoke. Full original latest-two-version vendor matrix and/or full required login-search-attempt pathways have not been shown for all targets. Status stays partially verified with documented deviation, faculty acceptance pending. |
| Status | Blocked |
| Executable files | Acceptance tooling in System Validation Report |
| Evidence | [NFR006_BROWSER_COMPATIBILITY.md](NFR006_BROWSER_COMPATIBILITY.md); [DEVIATIONS.md](DEVIATIONS.md) |
| Sprint / Part 3 change | Sprint 2 acceptance tooling; preserve original thresholds and external acceptance obligations. |

## TC-REL-01 — Attempt survives restart; no loss under concurrency

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.47; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | NFR-007 |
| Test type | Reliability |
| Preconditions | Staging |
| Input / data | — |
| Execution steps | Submit → get 201 → restart api container → query; 100 parallel submits by 100 students |
| Expected result (unchanged) | Attempt present after restart; exactly 100 records |
| Implementation | scripts |
| Actual result | Docker daemon unavailable; no API-container restart plus 100-student concurrent durability run. Fresh-connection and no-retake race tests do not replace this. |
| Status | Blocked |
| Executable files | Acceptance tooling in System Validation Report |
| Evidence | [PART3_SYSTEM_VALIDATION_REPORT.md](PART3_SYSTEM_VALIDATION_REPORT.md) |
| Sprint / Part 3 change | Sprint 2 acceptance tooling; preserve original thresholds and external acceptance obligations. |

## TC-TST-01 — Services run without UI or real DB

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.47; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | NFR-008 |
| Test type | Unit |
| Preconditions | CI agent |
| Input / data | — |
| Execution steps | npm test in server/ (mocks, in-memory MongoDB) |
| Expected result (unchanged) | Suite passes headless with no browser and no external DB |
| Implementation | scripts |
| Actual result | Backend Jest completed headlessly using mocks and owned in-memory MongoDB processes; no browser UI or external/shared database required. |
| Status | Pass |
| Executable files | Acceptance tooling in System Validation Report |
| Evidence | [PART3_SYSTEM_VALIDATION_REPORT.md](PART3_SYSTEM_VALIDATION_REPORT.md) |
| Sprint / Part 3 change | Sprint 2 acceptance tooling; preserve original thresholds and external acceptance obligations. |

## TC-SEC-01 — Passwords hashed, never logged

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.47; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | SEC-001 |
| Test type | Security |
| Preconditions | User registered with known pwd |
| Input / data | [valid synthetic password] |
| Execution steps | Inspect users collection; grep logs |
| Expected result (unchanged) | $2b$12$ hash; password string absent from all logs |
| Implementation | server/src/middleware |
| Actual result | {"registrationStatus": 201, "bcryptPrefix": "$2b$12$", "knownPasswordAndAccessTokenAbsentFromCapturedAppLogs": true, "scope": "Real isolated Express request logs captured in memory; not a deployment-wide log audit."} |
| Status | Pass |
| Executable files | server/tests/auth.middleware.test.js; server/tests/inputSecurity.auth.integration.test.js; server/tests/role.permission.matrix.integration.test.js; scripts/part3-stp-additional.cjs |
| Evidence | [part3-evidence/stp-additional.json](part3-evidence/stp-additional.json) |
| Sprint / Part 3 change | Sprint 2 acceptance tooling; preserve original thresholds and external acceptance obligations. |

## TC-SEC-02 — Expired / tampered / missing JWT

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.47; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | SEC-002 |
| Test type | Security |
| Preconditions | Valid token available |
| Input / data | — |
| Execution steps | Call GET /users/me with expired, signature-modified, alg "none" and no token |
| Expected result (unchanged) | 401 for every case |
| Implementation | server/src/middleware |
| Actual result | {"statuses": [401, 401, 401, 401]} |
| Status | Pass |
| Executable files | scripts/part3-stp-conformance.cjs; server/tests/profile.integration.test.js |
| Evidence | [part3-evidence/stp-conformance.json](part3-evidence/stp-conformance.json) |
| Sprint / Part 3 change | Part 3 authorized correction: submitted logout/profile contract restored; name-only updates; failed-login limit. Original expected result unchanged. |

## TC-SEC-03 — RBAC matrix

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.47; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | SEC-003 |
| Test type | Security |
| Preconditions | 4 accounts (one per class) |
| Input / data | ~40 combinations |
| Execution steps | Automated role × endpoint table (SAD §3.9.2) |
| Expected result (unchanged) | Every result matches the matrix (200/201 or 403) |
| Implementation | server/src/middleware |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/auth.middleware.test.js; server/tests/inputSecurity.auth.integration.test.js; server/tests/role.permission.matrix.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 acceptance tooling; preserve original thresholds and external acceptance obligations. |

## TC-SEC-04 — NoSQL injection and XSS

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.47; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | SEC-004, FR-014 |
| Test type | Security |
| Preconditions | — |
| Input / data | {"email":{"$gt":""}}; <script>alert(1)</script> |
| Execution steps | Login with operator payload; comment with script tag; render page |
| Expected result (unchanged) | 400 for injection; comment shown as text, no script runs |
| Implementation | server/src/middleware |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/auth.middleware.test.js; server/tests/inputSecurity.auth.integration.test.js; server/tests/role.permission.matrix.integration.test.js |
| Evidence | [part3-evidence/security-browser/sec004-results.json](part3-evidence/security-browser/sec004-results.json) |
| Sprint / Part 3 change | Sprint 2 acceptance tooling; preserve original thresholds and external acceptance obligations. |

## TC-SEC-05 — TLS configuration

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.47; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | SEC-005 |
| Test type | Security |
| Preconditions | Deployed stack |
| Input / data | TLS 1.0, 1.1, 1.2, 1.3 |
| Execution steps | curl http://; testssl.sh / sslscan |
| Expected result (unchanged) | HTTP → 301 HTTPS; only TLS 1.2/1.3 accepted; HSTS header present |
| Implementation | server/src/middleware |
| Actual result | No running Docker TLS stack. Static discrepancy P3-D05: STP expects 301, profile/tests specify 308. TLS1.0/1.1 rejection, TLS1.2/1.3 and HSTS not measured now. |
| Status | Blocked |
| Executable files | server/tests/auth.middleware.test.js; server/tests/inputSecurity.auth.integration.test.js; server/tests/role.permission.matrix.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 acceptance tooling; preserve original thresholds and external acceptance obligations. |

## TC-SEC-06 — Upload type and size

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.47; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | SEC-006, FR-010 |
| Test type | Security (BVA) |
| Preconditions | Contributor |
| Input / data | 20 MB PDF; 20 MB + 1 B PDF; .exe renamed .pdf; .svg |
| Execution steps | Upload test files |
| Expected result (unchanged) | 201; 413; 415; 415 |
| Implementation | server/src/middleware |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.routes.test.js; server/tests/material.fileValidation.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 acceptance tooling; preserve original thresholds and external acceptance obligations. |

## TC-SEC-07 — IDOR on material and quiz

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.48; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | SEC-007 |
| Test type | Security |
| Preconditions | A owns M1 and Q1; B is a contributor |
| Input / data | — |
| Execution steps | B sends PATCH/DELETE M1 and PUT/DELETE Q1 |
| Expected result (unchanged) | 403 on all four; data unchanged |
| Implementation | server/src/middleware |
| Actual result | Mapped automated assertions passed on the recorded baseline; equivalent synthetic data used. See executable test names in executed-test-index.json. This is automated-level evidence, not deployment acceptance. |
| Status | Pass |
| Executable files | server/tests/material.revisions.integration.test.js; server/tests/quiz.auth.db.integration.test.js |
| Evidence | [part3-evidence/executed-test-index.json](part3-evidence/executed-test-index.json) |
| Sprint / Part 3 change | Sprint 2 acceptance tooling; preserve original thresholds and external acceptance obligations. |

## TC-SEC-08 — Answer keys not exposed

| Field | Record |
|---|---|
| Original source / revision | STP-1 p.48; Updated current execution and repair mapping; original ID, requirement, objective and oracle retained |
| SRS requirement | SEC-008 |
| Test type | Security |
| Preconditions | Published quiz; student token |
| Input / data | — |
| Execution steps | GET /quizzes/{id}; inspect full JSON and network tab before submit |
| Expected result (unchanged) | No answerKey / correctAnswer anywhere before submission |
| Implementation | server/src/middleware |
| Actual result | Captured actual successful student quiz GET network responses before submission; neither answerKey nor correctAnswer appeared anywhere in JSON. |
| Status | Pass |
| Executable files | server/tests/auth.middleware.test.js; server/tests/inputSecurity.auth.integration.test.js; server/tests/role.permission.matrix.integration.test.js; scripts/part3-system-browser.cjs |
| Evidence | [part3-evidence/system-browser/results.json](part3-evidence/system-browser/results.json) |
| Sprint / Part 3 change | Sprint 2 acceptance tooling; preserve original thresholds and external acceptance obligations. |

## P3-PROFILE-EMAIL-01 — Supplementary profile-alias conformance

FR-005; extends TC-AUTH-16; real API/MongoDB integration. Preconditions: disposable student and valid login-issued JWT. Data: synthetic new email. Steps: PATCH `/api/v1/profile` with email and inspect the owned database. Expected: HTTP 400; unchanged email. Actual: HTTP 400; email unchanged. **Pass.** Executable: `scripts/part3-stp-conformance.cjs`; [evidence](part3-evidence/stp-conformance.json). This was a genuine SRS violation before the authorized name-only update fix. Both `/users/me` and `/profile` now use the same guarded handler.
