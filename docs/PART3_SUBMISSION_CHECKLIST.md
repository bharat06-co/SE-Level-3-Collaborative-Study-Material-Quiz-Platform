# Part 3 — Final upload checklist (12 November 2026)

**Faculty's required four reports:**

- [x] `docs/PART3_UNIT_TEST_REPORT.md` — already merged on `main`; leave intact.
- [x] `docs/PART3_CODE_COVERAGE_REPORT.md` — already merged on `main`; leave intact.
- [x] `docs/PART3_BRANCH_COVERAGE_REPORT.md` — already merged on `main`; leave intact.
- [ ] `docs/PART3_SYSTEM_VALIDATION_REPORT.md` — upload from this package.

**Other Part 3 documentation:**

- [ ] `docs/PART3_UPDATED_TEST_CASES.md` — 121-case reconciled original test register; upload.
- [ ] `docs/NFR004_PARTICIPANT_OBSERVATION_SHEET.md` — upload.
- [ ] `docs/NFR004_FINAL_USABILITY_REPORT.md` — upload.
- [ ] `docs/NFR004_USABILITY.md` — replace existing file with status-corrected kit.
- [ ] `docs/NFR_ACCEPTANCE.md` — replace existing file with NFR-004 completion addendum.
- [ ] `docs/NFR003_24H_FINAL_REPORT.md` — upload.
- [ ] `docs/NFR003_INDEPENDENT_AUDIT.md` — upload.
- [ ] `docs/part3-evidence/NFR003_24H_FINAL_EVIDENCE.zip` — supporting raw timestamped evidence; upload if GitHub accepts the ZIP.

**Pre-upload confirmations:**

- [ ] Confirm the new PR changes only the above files, not existing protected Part 1 PDFs or test source.
- [ ] Confirm all relative Markdown links resolve after merging to main.
- [ ] Confirm the observer's P1–P5 results are genuine; do not fill the missing P3–P5 clock times retrospectively.
- [ ] Confirm all files render correctly on GitHub (no encoding corruption, incomplete upload or secrets).
- [ ] Run/observe PR CI; if dependency audit fails, confirm branch is based on currently patched main (Mongoose 8.24.8), not an older branch.
- [ ] Merge only after checking the PR diff and CI; refresh `main/docs` afterward.

**Important:** Three report files already exist on main. Do **not** re-upload older `docs.zip` versions over them. The detailed STP register retains **111 Pass, 7 Blocked/partially verified, 3 Not Run**; it is not a claim that all original system acceptance obligations were finished.
