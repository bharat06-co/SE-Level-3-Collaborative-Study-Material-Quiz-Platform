# Quiz module integration

This module implements quiz persistence, validation, owner checks, publishing, and answer-key redaction for FR-020–023, FR-025, and the quiz side of SEC-007/008. It follows the submitted SAD quiz schema and `/api/v1/quizzes` routes.

## Authentication dependency

`createQuizRouter({ authenticate })` requires Anisha's verified Bearer-token middleware. That middleware must set `req.auth = { userId, role, contributor }` from a validated token and database user, never from request JSON or a caller-controlled header. The router fails closed when identity is absent. Mount it at `/api/v1/quizzes` in `server/src/app.js` after the auth module and exact context contract have merged. Until then it is deliberately unmounted from the production app. The tests inject an identity through a test-only middleware, so they prove the quiz rules but not JWT integration.

## Attempt integration

`createQuizService().getQuizForScoring(quizId)` returns the stored published quiz including answer keys for server-side scoring. Draft or missing quizzes return `QUIZ_NOT_AVAILABLE` (404). This method must only be called from the attempt service. HTTP list/detail/create/edit responses all use `publicView` and omit answer keys, including for nested questions and authors. The attempt service owns post-submission feedback and persistence.

## Scope and limitations

FR-024 material-page linkage waits for the material UI; FR-035 waits for stored attempts. No production MongoDB run or browser flow is claimed by the current unit/API tests. The whole-application SEC-007 acceptance test still needs the material module from Aryaroop.
