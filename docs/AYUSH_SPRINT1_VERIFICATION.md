# Ayush Sprint 1 integration verification

Verified locally on 23 October 2026 against the merged `main` features and the quiz authoring UI in PR #54. The API used a temporary MongoDB memory replica set and isolated educator/student accounts. The browser was headless Google Chrome 155.0.8059.86. No production identity or auth bypass was used.

## Automated checks

`npm run check` passed after resolving the latest-main integration: lint, 218 backend tests, 74 frontend tests, and the production client build. The merged quiz authentication test asserts `UNAUTHENTICATED` for missing or malformed Bearer headers and `TOKEN_INVALID` for invalid, tampered, or expired tokens. The merged attempt integration test confirms that pre-submission quiz JSON contains neither `answerKey` nor `correctAnswer`, while the submission response returns the correct answer in feedback.

## Local browser acceptance

1. From the home page, followed **Open quiz authoring** to `/quizzes` and signed in as an educator.
2. Created a draft with an MCQ answer key and `allowRetake=false`, changed its title, and published it.
3. Signed in as a separate student at `/quizzes/:quizId/attempt`. The quiz GET returned HTTP 200 with no `answerKey` or `correctAnswer` field, and the page showed no answer before submission.
4. Selected the correct MCQ option and submitted. The attempt POST returned HTTP 201 with a server score of 1/1; the result page showed the correct answer and that another attempt was unavailable.
5. Unpublished the quiz as the educator. A student quiz GET then returned HTTP 404.

The editor's deferred-save regression test also verifies that title, topic, retake, question replacement, save, and publication controls are disabled while a save is in flight. Existing MongoDB quiz tests verify author edit/publish/unpublish, contributor revocation, cross-author denial, administrator moderation, and answer-key redaction.

This is isolated local acceptance evidence. Shared staging browser acceptance remains pending because no staging URL exists. The quiz half of SEC-007 is covered; the material modification/deletion half depends on the material module's implementation and review.
