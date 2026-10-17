# Quiz authoring UI integration

`QuizEditor` supports draft creation, MCQ and true/false questions, inline validation, metadata edits, `allowRetake`, and publish/unpublish actions through the quiz API on PR #51. The server remains authoritative for author permissions and publish validation.

Quiz HTTP responses intentionally omit answer keys for SEC-008. When editing an existing quiz, the editor can update metadata without touching its questions. To change questions, the author selects **Replace questions** and supplies new answer keys for the whole set; it does not guess or expose stored keys.

Mount this component in the authenticated quiz-authoring navigation after Anisha's Bearer-token client integration and the quiz router are mounted. Do not expose it by bypassing authentication. The existing foundation status page is left intact until shared navigation is ready. Browser and database acceptance checks remain pending.
