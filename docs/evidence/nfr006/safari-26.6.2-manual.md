# Real Safari 26.6.2 manual acceptance log

- Date: 3 November 2026
- Commit: `d352a926be36f510bad5b3849a945c3a59f9633c`
- Environment: macOS 26.6.2 (25G83), Safari 26.6.2 (21624.5.1.11.3)
- Data: disposable local users and in-memory MongoDB; no production access

| Step | Observed evidence | Result |
| --- | --- | --- |
| Home | `API and MongoDB are connected.` and all main navigation links rendered | PASS |
| Material login/list/detail | Contributor login succeeded; public material, comments, rating, report and revision areas rendered | PASS |
| Material edit | Title changed to `SEC004 browser acceptance material Safari edited`; success notice and version 1 history rendered | PASS |
| Quiz create/publish | Created quiz `6ae95e18738358afd4b236df`, added an MCQ and changed status from draft to published | PASS |
| Student attempt/results | Student selected `Pass`; result rendered `1/1`, `100%`, `Correct`, and server-scored feedback | PASS |
| Quiz leaderboard | `SEC004 Student` rendered at rank 1 with best score 1 | PASS |
| Topic leaderboard | `browser compatibility` rendered the student at rank 1 with ranking score 100 | PASS |
| Forgot password | Enumeration-safe success message rendered for the disposable student email | PASS |
| Reset password page | New/confirm password controls and guidance rendered without layout breakage | PASS |

No visible compatibility failure interrupted the run. SafariDriver could not
create an automated session because Safari's `Allow remote automation` setting
was disabled, so the run above was performed through real Safari manually.

Not executed in real Safari: native file-picker material upload, a valid emailed
reset-token completion, a user-facing registration page (none exists on this
commit), and a second Safari version. These are not claimed as passed.
