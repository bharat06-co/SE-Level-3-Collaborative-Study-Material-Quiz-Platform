# Part 3 — Final upload checklist (12 November 2026)

**Faculty's required four reports:**

**16 November post-merge administrative review:** These files are present in the repository; the unchecked items below referred to a historical upload task, not missing files.

- [x] `docs/PART3_UNIT_TEST_REPORT.md` — already merged on `main`; leave intact.
- [x] `docs/PART3_CODE_COVERAGE_REPORT.md` — already merged on `main`; leave intact.
- [x] `docs/PART3_BRANCH_COVERAGE_REPORT.md` — already merged on `main`; leave intact.
- [x] `docs/PART3_SYSTEM_VALIDATION_REPORT.md` — upload from this package.

**Other Part 3 documentation:**

- [x] `docs/PART3_UPDATED_TEST_CASES.md` — 121-case reconciled original test register; upload.
- [x] `docs/NFR004_PARTICIPANT_OBSERVATION_SHEET.md` — upload.
- [x] `docs/NFR004_FINAL_USABILITY_REPORT.md` — upload.
- [x] `docs/NFR004_USABILITY.md` — replace existing file with status-corrected kit.
- [x] `docs/NFR_ACCEPTANCE.md` — replace existing file with NFR-004 completion addendum.
- [x] `docs/NFR003_24H_FINAL_REPORT.md` — upload.
- [x] `docs/NFR003_INDEPENDENT_AUDIT.md` — upload.
- [x] `docs/part3-evidence/NFR003_24H_FINAL_EVIDENCE.zip` — supporting raw timestamped evidence; upload if GitHub accepts the ZIP.

**Pre-upload confirmations:**

- [ ] Confirm the new PR changes only the above files, not existing protected Part 1 PDFs or test source.
- [ ] Confirm all relative Markdown links resolve after merging to main.
- [ ] Confirm the observer's P1–P5 results are genuine; do not fill the missing P3–P5 clock times retrospectively.
- [ ] Confirm all files render correctly on GitHub (no encoding corruption, incomplete upload or secrets).
- [ ] Run/observe PR CI; if dependency audit fails, confirm branch is based on currently patched main (Mongoose 8.24.8), not an older branch.
- [ ] Merge only after checking the PR diff and CI; refresh `main/docs` afterward.

**Important:** All four reports and the updated case register are present on main; do not overwrite them with older `docs.zip` files. The 16 November evidence reconciliation records **114 Pass, 7 Partially Verified / Blocked, 0 Not Run**. This does **not** mean every original STP procedure passed. Historical checklist pre-upload confirmations below are retained for provenance, not presented as newly executed checks.
