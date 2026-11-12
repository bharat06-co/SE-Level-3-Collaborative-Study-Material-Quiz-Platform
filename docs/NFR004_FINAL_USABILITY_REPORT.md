# NFR-004 final usability report

**Acceptance result: Pass.** All five recorded first-time participants completed TC-UX-01 without substantive assistance, exceeding the threshold of four out of five. The saved automated browser run passed all 10 evidence groups. The observer also confirmed both required-field messages on the Study materials sign-in form.

**Traceability** SRS v1.2 §5 · TC-UX-01 · Issue #35

## Method and human results

The moderated evaluation used a disposable local study platform with a seeded DBMS material and quiz. The task card asked each participant to sign in, find **DBMS Normalisation Notes**, open **DBMS Fundamentals** from that material, submit an attempt, and read the result. The protocol specified a fresh private browser window for each session and counted completion only when the participant reached the result screen without substantive help. [Usability protocol](NFR004_USABILITY.md)

Each of the five recorded rows reports that the result screen was reached and no assistance was given. Elapsed times for P1–P5 were **4, 4, 3, 5, and 3 minutes**, with a **median of 4 minutes**. Three participants scored **3/3** and two scored **2/3**. The completion criterion was based on reaching the result screen. Exact start and finish times for P3–P5 and participant-level inline error observations were unreported. [Participant observation sheet](NFR004_PARTICIPANT_OBSERVATION_SHEET.md)

## Inline validation evidence

The saved run of `npm run nfr004:validation` on **9 November 2026** reported **10/10 passing evidence groups and zero failures**. It used Playwright Chromium and Node 24.22.1 against the React frontend, Express API, and a disposable MongoDB replica set.

| Area | Verified behavior |
| --- | --- |
| Study materials | Sign-in displayed required-field and email-format errors. Upload, edit, and comment displayed inline errors for the tested invalid inputs. The material linked to its published DBMS quiz. |
| Quiz authoring | Sign-in and the quiz editor displayed field-level errors. Open-by-ID displayed an error for a malformed ID. |
| Student and leaderboard forms | Student sign-in and quiz-ID entry displayed inline errors. The leaderboard displayed errors for invalid quiz IDs and topic inputs. |
| Quiz attempt | Blank answers were accepted and led to server-scored results, as specified. |

The manual check on **12 November 2026 at 6:09 IST** covered the Study materials sign-in form. The observer saw **“Email is required.”** and **“Password is required.”** directly below their respective fields. The broader form coverage comes from the saved automated run. [Participant observation sheet](NFR004_PARTICIPANT_OBSERVATION_SHEET.md)

The source archive identifies commit `7c366c977a198c8db0112e9f13de234cd8dc9bd3` in its ZIP metadata. The extracted workspace had no Git checkout metadata, and the local test harness included Windows adjustments for Vite startup and fixture shutdown.
