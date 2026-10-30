import { Routes, Route, useParams, Link } from 'react-router-dom';
import App from './App';
import StudentAttemptPage from './features/attempts/StudentAttemptPage';
import QuizAuthoringPage from './features/quizzes/QuizAuthoringPage';
import LeaderboardPage from './features/quizzes/LeaderboardPage';
import MaterialLibraryPage from './features/materials/MaterialLibraryPage';
import MaterialDetailPage from './features/materials/MaterialDetailPage';
import AdminReportsPage from './features/materials/AdminReportsPage';
import { MaterialSessionProvider } from './features/materials/MaterialSession';
function AttemptRoute() { const { quizId } = useParams(); return <StudentAttemptPage quizId={quizId} />; }
export default function AppRoutes() {
  return <MaterialSessionProvider><Routes>
    <Route path="/" element={<App />} />
    <Route path="/attempt" element={<StudentAttemptPage />} />
    <Route path="/quizzes" element={<QuizAuthoringPage />} />
    <Route path="/leaderboard" element={<LeaderboardPage />} />
    <Route path="/quizzes/:quizId/attempt" element={<AttemptRoute />} />
    <Route path="/materials" element={<MaterialLibraryPage />} />
    <Route path="/materials/:id" element={<MaterialDetailPage />} />
    <Route path="/admin/reports" element={<AdminReportsPage />} />
    <Route path="*" element={<main className="shell"><h1>Page not found</h1><Link to="/">Platform home</Link></main>} />
  </Routes></MaterialSessionProvider>;
}
