# Related quizzes integration (FR-024)

`RelatedQuizzes` takes the current study material's `topic` and queries `/api/v1/quizzes?topic=...&status=published`. The quiz service on PR #51 matches topics case-insensitively and returns published quizzes only. The component fetches all pages and displays links; it never uses a direct material-to-quiz foreign key.

Aryaroop should render `<RelatedQuizzes topic={material.topic} />` on the material detail page once that page and Anisha's authenticated HTTP client exist. The component is deliberately not inserted into a placeholder material page. Its test covers loading, topic changes, pagination, empty states, and errors; the integrated material-page acceptance check remains pending.
