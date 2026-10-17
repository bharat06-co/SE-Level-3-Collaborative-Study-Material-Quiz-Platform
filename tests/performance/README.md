# NFR-002 scalability run

Run `ayush-scalability.js` against an isolated staging stack after authentication, published quizzes and persisted attempts are integrated. Use one published quiz with `allowRetake=true`, at least one valid question, and 100 distinct student accounts. Export short-lived access tokens to a private JSON file shaped as `[ { "accessToken": "..." }, ... ]`. Keep the file outside Git. Tokens must remain valid for the whole 10-minute run. Use test accounts and an expendable staging database because the run creates many attempts.

From the repository root, with k6 installed:

```sh
K6_BASE_URL=https://staging.example.org K6_QUIZ_ID=<24-hex-quiz-id> K6_USERS_FILE=/private/path/students.json k6 run --summary-export=results.json tests/performance/ayush-scalability.js
```

The script holds 100 virtual users for 10 minutes, checking page, browse, quiz detail and attempt responses on every iteration. It fails unless HTTP 5xx rate is 0% and functional checks pass 100%. Record the environment, token expiry setup, exact k6 version and summary. Run it together with Bharat's NFR-001 timing measurements so TC-PERF-01 and TC-PERF-02 use the same load run. This file is test preparation, not evidence that NFR-002 has passed.

NFR-006 / TC-PORT-01 still requires a running integrated UI. The required matrix is branded Chrome and Edge, Firefox and WebKit in Playwright, plus manual Safari on macOS/iOS where available, with browser versions and results recorded. Its login → search → attempt selectors must be written against the actual merged UI; a foundation-only smoke check cannot verify that flow or the latest two browser versions.
