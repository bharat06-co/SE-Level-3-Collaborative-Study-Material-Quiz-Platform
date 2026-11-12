# NFR-004 usability session kit (TC-UX-01)

## Purpose and boundary

This kit prepares the evidence required by Issue #35 and SRS v1.2 §5 / STP
TC-UX-01:

- at least 4 of 5 first-time users complete a quiz attempt without help;
- every form with a user-reachable invalid state shows inline validation;
- completion results and form-validation evidence are recorded.

**Execution addendum (12 November 2026):** The five first-time human sessions have now been observer-recorded as **5/5 unaided completions**, meeting the 4/5 threshold. See the [completed observation sheet](NFR004_PARTICIPANT_OBSERVATION_SHEET.md) and [final NFR-004 report](NFR004_FINAL_USABILITY_REPORT.md). The automated browser evidence was reported as 10/10 groups passing. The underlying human observations are owner/observer supplied and include missing exact clock times for P3–P5. The instructions below remain as the original session protocol.

## Traceability

| Item | Source | Acceptance |
| --- | --- | --- |
| NFR-004 | SRS v1.2 §5 | ≥4/5 first-time users complete a quiz attempt without help |
| TC-UX-01 | STP v1.0 | Log in, find the DBMS quiz, attempt it, read the result |
| Inline validation | SRS §3.1 and NFR-004 | Every form shows inline validation messages where invalid input is possible |
| Issue | GitHub #35 | Moderated session, completion results and form evidence recorded |

## Session design

### Participants

- Recruit five people who have not previously used this application.
- Do not use team members, the facilitator or the observer as participants.
- Record only anonymous IDs `P1`–`P5` in this repository.
- Keep signed consent forms and any contact details outside Git.
- Obtain consent for observation and note-taking. Do not record audio or video
  unless separately consented and stored outside the repository.

### Roles

- **Facilitator:** welcomes the participant, reads the task card and does not
  coach during the task.
- **Observer:** starts the timer, records assistance, completion and the result
  screen. The observer must not point at controls or explain the UI.
- One person may perform both roles only if the session can still be observed
  accurately without helping.

### Equipment and environment

Use a clean checkout at the commit recorded in
`test-results/nfr004/session-environment.json`. The fixture is disposable and
loopback-only; it does not read `.env`, use a shared database or persist
participant attempts after shutdown.

```bash
npm ci
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install chromium
npm run nfr004:session:verify
npm run nfr004:session
```

`npm run nfr004:session` prints the app URL, material and quiz details, five
disposable participant accounts and one disposable password. Keep that terminal
open for the whole session. Press `Ctrl+C` to stop and delete the temporary
MongoDB data, upload directory, API process and Vite process.

Use a fresh private/incognito window for each participant so no session is
shared. If a browser or machine failure prevents an attempt, record it as a
technical failure and repeat with a replacement first-time participant rather
than helping the original participant.

### Task card

Read this wording without adding hints:

> You are trying this study platform for the first time. Please sign in with
> the account on this card, open Study materials and find the DBMS normalisation
> notes, then find and open the DBMS Fundamentals quiz from that material.
> Answer the questions, submit the attempt and read your result aloud. I cannot
> help while you work, but I will stop you if something breaks.

Provide:

- app URL and start page: printed by `npm run nfr004:session`;
- participant email and the shared disposable password;
- quiz ID only as a fallback if the material-to-quiz link is unavailable.

### Assistance rule

A participant succeeds only when they reach the result screen with no
substantive help.

Count as assistance:

- naming or pointing to a control;
- explaining what a field, message or screen means;
- telling the participant where to click or what to type;
- correcting an answer, email or quiz ID;
- stepping in after a validation message.

Do not count as assistance:

- reading the task card;
- restarting the browser after a technical failure;
- neutral replies such as “I cannot help during this task; use your best
  judgement”;
- urgent safety or privacy intervention. If this happens, record the attempt
  as assisted and stop/repeat it with a replacement participant.

### Observation record

For each participant record:

- start and end time;
- whether the result screen appeared;
- whether any assistance was required;
- any validation message they encountered;
- the score/feedback they read aloud;
- any non-identifying comment about confusion, without recording personal data.

## Inline-validation evidence

### Automated browser evidence

Run:

```bash
npm run nfr004:validation
```

This starts the real React frontend and real Express/MongoDB-backed API in an
isolated disposable environment, then checks field-level `aria-invalid` state
and visible inline alerts in Chromium. It also verifies the material-to-related-
quiz link used by the session task. It writes:

- `test-results/nfr004/inline-validation-results.json`;
- screenshots `material-signin-inline-validation.png`,
  `material-upload-inline-validation.png`,
  `material-edit-inline-validation.png`,
  `material-comment-inline-validation.png`,
  `material-related-quiz.png`,
  `quiz-open-id-inline-validation.png`,
  `quiz-editor-inline-validation.png`,
  `leaderboard-inline-validation.png`,
  `student-signin-inline-validation.png`,
  `student-quiz-id-inline-validation.png` and
  `attempt-blank-answers-valid.png`.

The browser check passed locally on 30 October 2026 with 10/10 evidence groups.
Re-run it at the session commit and retain the generated JSON and screenshots
with the session evidence. The `test-results/` directory is ignored by Git.

### Manual validation audit during the session

The observer should also confirm at least one visible inline error on the
forms used during the session. The automated browser check remains the
repeatable evidence; this manual observation confirms the participant-facing
build matches it.

| Form | Invalid path | Expected inline message | Evidence |
| --- | --- | --- | --- |
| Material sign-in (`MaterialSignIn`) | Empty fields; malformed email | `Email is required.` / `Password is required.` / `Enter a valid email address.` | Automated + manual |
| Material upload (`MaterialForm` create) | Empty submit | Title, description, category, topic, tags, file and rights messages | Automated + manual |
| Material edit (`MaterialForm` edit) | Empty title; malformed shared ID | Title and 24-hex-character shared-ID messages | Automated |
| Material comment | Empty comment | `Comment cannot be empty.` | Automated + manual |
| Quiz-author sign-in | Empty fields | `Email is required.` / `Password is required.` | Automated |
| Quiz-author open-by-ID | Malformed ID | `Quiz ID must be 24 hexadecimal characters.` | Automated |
| Quiz editor | Empty title/topic/question/options/answer | Field-level title, topic, question, options and answer messages | Automated + manual |
| Leaderboard query | Empty/malformed quiz ID; empty/over-length topic | `Enter a valid 24-character quiz ID.` / `Enter a topic of 1–100 characters.` | Automated |
| Student sign-in | Empty fields | `Email is required.` / `Password is required.` | Automated + manual |
| Student quiz-ID entry | Empty or malformed ID | `Quiz ID is required.` / `Quiz ID must be 24 hexadecimal characters.` | Automated + manual |
| Rating form | Select constrained to 1–5 | Local validator exists; no user-reachable invalid option | Code review |
| Material report form | Constrained reason; optional note with length limit | No user-reachable invalid state | Code review |
| Material filters | Optional search fields | No invalid state; empty filters are valid | Code review |
| Moderation queue status | Constrained select | No invalid state | Code review |
| Quiz attempt answers | Blank answers are allowed | No error; blank answers are scored as unanswered/zero | Automated + manual |

The leaderboard uses visible `role="alert"` errors rather than marking its
inputs `aria-invalid`. Server validation remains authoritative. The quiz
attempt deliberately does not require every answer because blank answers are a
valid scoring case, not a malformed form.

## Evidence to record

### Environment

| Field | Value |
| --- | --- |
| Date and time | |
| Commit | |
| Node version | |
| Browser and version | |
| App origin | |
| Session start | `/materials` |
| Material | `DBMS Normalisation Notes` |
| Quiz discovery | `Quizzes for dbms` → `DBMS Fundamentals` |
| Quiz ID/title | |
| Facilitator | |
| Observer | |
| Environment JSON path | `test-results/nfr004/session-environment.json` |

### Participant results — completed 12 November 2026

| ID | Started (IST) | Finished (IST) | Result screen reached | Assistance required? | Assistance detail | Inline errors seen | Outcome |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | 5:25 (AM/PM unreported) | 5:29 (AM/PM unreported) | Yes; 3/3 | No | None recorded | Unreported | Unaided pass; 4 min |
| P2 | 6:00 (AM/PM unreported) | 6:04 (AM/PM unreported) | Yes; 2/3 | No | None recorded | Unreported | Unaided pass; 4 min |
| P3 | Unreported | Unreported | Yes; 3/3 | No | None recorded | Unreported | Unaided pass; 3 min |
| P4 | Unreported | Unreported | Yes; 2/3 | No | None recorded | Unreported | Unaided pass; 5 min |
| P5 | Unreported | Unreported | Yes; 3/3 | No | None recorded | Unreported | Unaided pass; 3 min |

**Success count: 5/5.** Data transcribed from the [observer sheet](NFR004_PARTICIPANT_OBSERVATION_SHEET.md); missing time-of-day details have not been filled in retrospectively. Participant-level inline-error observations were not reported; manual validation was checked separately.

### Validation observations — execution addendum

A separate manual check on 12 November at 6:09 IST verified the material sign-in form: blank email displayed `Email is required.` below Email, and blank password displayed `Password is required.` below Password. The saved automated run is **reported** to have passed 10/10 evidence groups on 9 November using Playwright Chromium; its raw JSON was not included in the two-file participant handoff. See [final report](NFR004_FINAL_USABILITY_REPORT.md). No claim is made that the observer manually checked every form.

### Observer notes

Record only non-identifying observations. Do not paste names, email addresses,
phone numbers, signatures or screenshots containing personal data.

- Common points of confusion:
- Validation messages that participants did not notice:
- Technical failures and replacements:
- Suggested follow-up issues:

## Closure checklist

- [x] Five first-time participant completions are recorded; consent storage is not independently verified by these two documents.
- [x] Five observation rows record unaided completion; three exact clock-time pairs are unreported.
- [x] Saved automated validation reported 10/10 groups passed; raw JSON was not supplied in this handoff.
- [x] Manual inline validation recorded for the material sign-in form; other form coverage is reported from automation.
- [x] Links to anonymized observer sheet and final human-testing report included; no screenshots requested for the submission package.
- [x] `docs/NFR_ACCEPTANCE.md` updated in this documentation package.
- [ ] GitHub issue #35 is administratively closed; its original checklist and formal closure approval were not separately verified.

If fewer than 4/5 succeed, do not close #35. Record the failures and raise
usability fixes as separate work before repeating the session.
