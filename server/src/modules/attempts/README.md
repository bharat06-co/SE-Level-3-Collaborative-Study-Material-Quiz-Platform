# Attempts, scoring and immediate feedback — Bharat

FR-030/031/032 backend: routes → verified auth/student/schema middleware → controller → service/pure scorer → repository/model. The React attempt/result screen lives in `client/src/features/attempts`.

POST `/api/v1/quizzes/:quizId/attempts`; student contributors allowed, educator/admin denied. Production defaults to 401 until real verified auth is wired through the router factory. No mock identity or fake JWT is supported.

See `docs/FR030_031_032_IMPLEMENTATION.md` and `docs/CONTRACTS.md` for real integration points, optional private quiz lookup, snapshots, the proposed no-retake race guard and executed evidence. History/progress and SEC-004 completion are not claimed.
