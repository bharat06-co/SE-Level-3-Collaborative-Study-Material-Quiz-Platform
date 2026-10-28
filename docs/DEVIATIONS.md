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


## DEV-05 — Proposed attempt race guard and historical feedback fields
- Status: IMPLEMENTED IN FR-030 BRANCH, pending owner/database-lead review; no peer/faculty approval is claimed.
- SAD §4.1.1 specifies a service check and a simultaneous-submission test for BR-2. A check followed by an insert alone races across requests/processes; a simple unique quiz/student index would incorrectly forbid all allowed retakes.
- Preserve the service check. Add optional internal `retakeGuard = quizId + ':' + studentId` only on an insert performed with `allowRetake:false`, protected by partial unique index `attempt_no_retake_guard` (filter: guard is a string). Map collisions on that specific key to 409 RETAKE_NOT_ALLOWED. Allowed retakes have no guard and remain unrestricted.
- Indexes are ensured before inserting. Existing non-retake history created by this or earlier implementations still prevents later attempts through the service check. Other writers must use the same repository/rule; direct database writes are not protected against bypassing application policy.
- `answers` additionally stores `correctAnswer` and `unanswered` with response/isCorrect. This preserves the actual submission feedback when quiz answer keys change (D-3) without introducing quiz versioning or altering the required public response.
- No new collection or transaction/replica-set requirement. Real MongoDB race tests passed for independent Express/repository instances sharing the database.
- The quiz's status/retake policy is read as a submission snapshot. Concurrent author edits/unpublish operations are not serialized with submission; cross-operation atomicity is not claimed. Coordinate any stronger policy with Ayush.
- No submitted PDF changed and no claim this extension was original SRS wording.


## DEV-06 — SEC-004 defensive traversal and plain-text working policy
- Proposed implementation clarification, pending owner/integration review; not original SRS numeric limits or faculty approval.
- Bound shared parsed-input traversal to depth 64 and 20,000 visited values. Iterative traversal rejects excessive complexity with 400 rather than recursive stack exhaustion. Reject reserved `__proto__`, `prototype`, and `constructor` keys as well as MongoDB operator/dotted keys. String values are preserved.
- Plain-text comments preserve markup literally in storage and use context-safe React text nodes on output. Do not HTML-encode stored strings or add a production test-comment endpoint.
- Plain-text helper trims outside whitespace, checks JavaScript UTF-16 length (default 1–1000 for comments), and rejects null bytes. Apply feature-specific bounds for other fields; do not apply trimming to passwords.
- This shared implementation is not evidence that unmerged feature modules or the future FR-014 comment page already satisfy end-to-end SEC-004 acceptance.


## DEV-07 — Sprint 2 moderation semantics
- Implementation clarification, not original SRS wording; pending reviewer/faculty acknowledgement.
- Reporting is allowed for otherwise visibility-eligible non-admin users even when the material is currently hidden, so a second eligible user can report an item already hidden by the first report. This supports the STP two-open-report moderation case without bypassing private/shared access checks.
- Administrators review reports but cannot submit them. Duplicate open reports by the same user on the same material return 409 `REPORT_EXISTS`.
- A successful report hides the material immediately. A default limit of 10 reports per user per hour is applied in the report service and can be configured when constructing it.
- Dismiss restores visibility only if no other open report remains for that material; uphold keeps it hidden. Decisions record reviewer/timestamp and emit an audit log event. `hidden` is changed with the same version predicate used by other material mutations.
- Reasons are `copyright`, `spam`, `inappropriate`, `misleading`, `other`; optional notes use the SEC-004 plain-text rules (≤1000 trimmed UTF-16 units).

## DEV-08 — Material revision snapshots
- Implementation clarification, not original SRS wording; pending reviewer/faculty acknowledgement.
- Metadata or file replacement snapshots the material state before the change into `materialrevisions`, numbered per material. Visibility-only changes do not create a revision.
- File replacement stores the new bytes under a new storage key and keeps the previous file reference in the revision snapshot; the old object is not deleted by this feature.
- Revision history is owner/admin only. Concurrent edits reuse the material version predicate and retry; failed revision writes are removed rather than leaving an orphan snapshot.
