# Quiz authoring UI integration

`QuizEditor` supports draft creation, MCQ and true/false questions, inline validation, metadata edits, `allowRetake`, and publish/unpublish actions through the quiz API on PR #51. The server remains authoritative for author permissions and publish validation.

Quiz HTTP responses intentionally omit answer keys for SEC-008. When editing an existing quiz, the editor can update metadata without touching its questions. To change questions, the author selects **Replace questions** and supplies new answer keys for the whole set; it does not guess or expose stored keys.

The application links to `/quizzes`, a Sprint 1 authoring page backed by the merged login endpoint and Bearer-token quiz middleware. Its access token stays in React memory and is sent only in the `Authorization` header on quiz requests. The page lists drafts, opens a published quiz by ID, and mounts this editor after sign-in. The server checks current permissions on every request; the UI's role checks only guide what it displays. The token is cleared on sign-out or an unauthorized response. A page reload requires sign-in again until the team's shared client auth flow is integrated. Database-backed HTTP acceptance is covered by the server suite; browser and staging acceptance remain pending.
