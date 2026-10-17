# Part-2 working deviations and clarifications

This is a NEW working log. Submitted Part-1 PDFs and commit history remain unchanged. Entries explain real differences/clarifications; recording one is not automatic faculty approval. Add actual PR links, decision dates and approval evidence during review; do not backdate them.

## DEV-01 — GitHub Actions instead of Jenkins
- Source: submitted stack/CI documents vs original Part-2 brief.
- Starter: GitHub Actions on push and PR runs lint, Jest coverage tests and frontend build.
- Reason: Part-2 requires GitHub Actions.
- Limit: GitHub-hosted run must be observed after upload; SonarQube integration and full acceptance testing remain pending. Local checks are not a substitute for a real SonarQube quality gate.
- Status: working implementation; owner/reviewer to confirm against original brief and attach PR evidence.

## DEV-02 — Revised two-sprint working schedule
- Original plan had a longer six-sprint/testing schedule.
- Agreed working dates: Sprint 1, 17–23 Oct 2026; Sprint 2, 24–30 Oct 2026. First/final end dates retained.
- The brief's listed starts were 19 and 26 Oct; Bharat chose earlier Saturday starts. Teacher flexibility is reported by Bharat; retain any actual clarification evidence if required.
- Submitted PDFs are preserved. Full test targets are not silently reduced.
- Status: team working plan; attach actual faculty clarification if needed.

## DEV-03 — Explicit health payload and 503 diagnostic extension
- Source: SAD §4.4 requires health to check process and DB but does not define the full health response/error catalogue entry.
- Starter success: HTTP 200, `{status:"ok",checks:{process:"up",database:"connected"}}`.
- Starter not-ready: HTTP 503, `SERVICE_UNAVAILABLE`, using the shared error envelope.
- Reason: avoid falsely reporting readiness when DB is disconnected.
- Impact: diagnostic-only; no business API endpoint is renamed. Review and accept/change this extension before merging.
- Owner decision: Bharat authorised retaining this health readiness behaviour and documenting it as a technical clarification in the follow-up chat. This is not claimed to be original SRS wording.
- Status: OWNER-ACCEPTED working clarification; independent teammate PR review and any required faculty acknowledgement remain pending.

## CLAR-01 — Functional requirement count
SRS v1.2 prints 28 but enumerates 27 (6 accounts, 9 material, 7 quiz/leaderboard, 5 attempts/progress). Keep the actual IDs and original PDFs. No invented requirement is added.

## Open clarifications — not implemented or resolved here
- Exact refresh-on-expired-access-token error semantics (`TOKEN_EXPIRED` reference vs catalogue).
- Material delete API catalogue completeness for SEC-007/TC-SEC-07.
- Runtime decision is recorded in DEV-04 below. Do not restore the EOL Node 20 version merely because it appears in the original PDF.

## DEV-04 — Supported Node 24 LTS instead of EOL Node 20
- Recorded at UTC: 2026-10-17T05:59:20+00:00.
- Source: original SAD §3.6 specified Node 20. Official lifecycle reference: https://nodejs.org/en/about/previous-releases (Node 20 EOL, Node 24 LTS when checked).
- Reason: do not begin team implementation and deployment on an unsupported runtime simply to match a historical document.
- Owner authorisation: Bharat instructed the assistant to proceed with the recommended fixes after the runtime/health review. No independent peer or faculty approval is claimed.
- Working decision: Node 24 LTS, current major-24 patch; npm 11.
- Updated together: `.nvmrc`, `.node-version`, root/server/client `package.json` engines, lockfile, API/web Docker build stages, CI runtime selection/verification and working setup/contract documentation.
- No change to submitted PDFs, FR IDs, business APIs or feature ownership.
- Verification: see the regenerated `docs/FOUNDATION_TEST_REPORT.md` for actual Node 24 clean-install, lint/tests/build and integration results. Docker and remote GitHub Actions still require execution on their actual environments.
- Status: OWNER-AUTHORISED change, subject to independent foundation PR review; no faculty approval is implied.
