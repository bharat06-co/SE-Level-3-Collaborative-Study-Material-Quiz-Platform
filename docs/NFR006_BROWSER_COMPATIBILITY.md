# NFR-006 browser compatibility evidence

Issue: #38 · Sprint 3 / Part 3 system validation · Test: TC-PORT-01

Latest-main test commit: `d352a926be36f510bad5b3849a945c3a59f9633c`

Test date: 3 November 2026

## Existing evidence reviewed

Merged PR #87 introduced the reusable real-application browser script and the
required-all GitHub Actions job. Its retained workflow artifact contains
`results.json` and screenshots for all four engine/vendor runs:

| PR #87 run (30 October 2026) | Exact version | Result | Scope |
| --- | --- | --- | --- |
| Google Chrome | 156.0.8078.79 | PASS | Health, material list/detail, quiz editor, page errors |
| Microsoft Edge | 156.0.4314.56 | PASS | Same initial smoke scope |
| Playwright Firefox | 157.0 | PASS | Same initial smoke scope |
| Playwright WebKit | 27.2 | PASS | Same initial smoke scope |
| Real Safari on macOS | 26.6.2 | PASS | Manual initial smoke recorded in PR #87 |

Source: [PR #87](https://github.com/bharat06-co/SE-Level-3-Collaborative-Study-Material-Quiz-Platform/pull/87)
and [workflow run 41008936453](https://github.com/bharat06-co/SE-Level-3-Collaborative-Study-Material-Quiz-Platform/actions/runs/41008936453).

## Sprint 3 environment

- Apple Silicon Mac running macOS 26.6.2 (build 25G83).
- Real installed Google Chrome 156.0.8078.80.
- Playwright-bundled Firefox 157.0 and WebKit 27.2.
- Real installed Safari 26.6.2 (21624.5.1.11.3).
- Microsoft Edge was not installed locally. The expanded required-all workflow
  installs branded Edge and records its exact version in the PR artifact.
- All runs used disposable users, an in-memory MongoDB replica set and local
  loopback HTTP. No production identity, database or deployment was used.

## Expanded automated acceptance

The existing `scripts/nfr006-browser-smoke.cjs` was extended rather than
replaced. On 3 November it passed locally in Chrome, Firefox and WebKit against
the commit above.

| Scenario | Chrome 156.0.8078.80 | Firefox 157.0 | WebKit 27.2 |
| --- | --- | --- | --- |
| Home health and main navigation | PASS | PASS | PASS |
| Browser-side registration API and login validation | PASS | PASS | PASS |
| Material list and detail | PASS | PASS | PASS |
| Material upload and metadata edit | PASS | PASS | PASS |
| Quiz create, edit and publish | PASS | PASS | PASS |
| Student attempt and result display | PASS | PASS | PASS |
| Quiz and topic leaderboards | PASS | PASS | PASS |
| Forgot-password response and reset-page validation | PASS | PASS | PASS |
| Uncaught page/console errors or HTTP 5xx | NONE | NONE | NONE |

Machine-readable results and screenshots are retained under
[`docs/evidence/nfr006`](./evidence/nfr006/). The screenshots show the final
password-reset page after all preceding workflow assertions passed; the JSON
file lists every asserted scenario.

## Real Safari 26.6.2 manual acceptance

Real Safari was exercised separately from Playwright WebKit on the same local
fixture and commit. The visible manual run passed:

1. Home health and navigation rendered correctly.
2. Contributor login, material list/detail and metadata editing worked. The
   changed title and revision-history entry appeared after save.
3. Quiz authoring created and published `NFR006 Safari quiz` with an MCQ.
4. A separate student login opened the published quiz, submitted the correct
   answer and displayed the authoritative `1/1` result and feedback.
5. Quiz and topic leaderboards both rendered the student and correct score.
6. Forgot-password returned the enumeration-safe success message.
7. The reset-password form, password guidance and controls rendered correctly.
8. No visible layout breakage, disabled primary controls or browser-specific
   JavaScript failure interrupted the run.

The detailed observation log is
[`safari-26.6.2-manual.md`](./evidence/nfr006/safari-26.6.2-manual.md).
SafariDriver remote automation was disabled on this Mac, so this result is
recorded as manual evidence and is not described as an automated pass.

## Compatibility findings

- No browser-specific compatibility defect was found in the tested versions.
- The application has no user-facing registration route on this commit.
  Registration compatibility was therefore checked through the browser's
  `fetch` API, while the absence of a registration page is recorded as a
  product coverage gap rather than a browser-specific failure.
- Real Safari material metadata editing passed. The native file-picker upload
  was covered by WebKit but was not repeated manually in real Safari.
- Password-reset page rendering and validation were checked. A valid emailed
  reset-token journey was outside this compatibility fixture.

## Latest-two-version requirement

The SRS asks for the latest two versions of Chrome, Edge, Firefox and Safari.
Only the versions explicitly listed above were executed against this commit.
This Mac does not retain previous stable browser releases side by side, and no
browser-farm account is available. Therefore:

| Browser family | Tested against latest main | Still unavailable |
| --- | --- | --- |
| Chrome | 156.0.8078.80 | Previous stable Chrome release |
| Edge | PR workflow branded Edge run (exact version in artifact) | Previous stable Edge release |
| Firefox | Playwright Firefox 157.0 | Previous stable Firefox release |
| Safari | Real Safari 26.6.2; WebKit 27.2 supplemental | A second real Safari release |

The unavailable versions remain **UNTESTED**, not passed. Issue #38 should stay
open until the reviewer accepts this documented environment limitation or the
team supplies the missing previous-version devices/browser farm.
