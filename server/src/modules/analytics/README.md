# Analytics module

Owner: Bharat (progress) and Ayush (leaderboard). The leaderboard uses routes → controller → service → repository and reads the shared `quizzes`, `attempts` and `users` collections without defining a competing Attempt model.

`createLeaderboardRouter({ authenticate })` needs Anisha's verified Bearer-token middleware setting `req.auth.userId`. Mount it at `/api/v1/leaderboard` when authentication is integrated. The leaderboard component in `client/src/features/leaderboard` expects the shared HTTP client's future auth handling and navigation. It is not added to the foundation status page.

Quiz rankings use each student's best score. Topic rankings sum the best percentage from each *published* quiz in a case-insensitively matched topic; a quiz unpublished after an attempt is omitted. Competition ranks are computed after aggregation. Bharat's Attempt model must retain `quizId`, `studentId`, `score` and `maxScore` as specified by SAD §3.6.1. This branch remains a draft until attempts are persisted and real API/UI tests can run.
