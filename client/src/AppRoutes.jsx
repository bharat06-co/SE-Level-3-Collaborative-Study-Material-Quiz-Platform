import { Routes, Route, useParams, Link } from 'react-router-dom';
import App from './App';
import StudentAttemptPage from './features/attempts/StudentAttemptPage';
import QuizAuthoringPage from './features/quizzes/QuizAuthoringPage';
function AttemptRoute() { const { quizId } = useParams(); return <StudentAttemptPage quizId={quizId} />; }
export default function AppRoutes() {
  return <Routes>
    <Route path="/" element={<App />} />
    <Route path="/attempt" element={<StudentAttemptPage />} />
    <Route path="/quizzes" element={<QuizAuthoringPage />} />
    <Route path="/quizzes/:quizId/attempt" element={<AttemptRoute />} />
    <Route path="*" element={<main className="shell"><h1>Page not found</h1><Link to="/">Platform home</Link></main>} />
  </Routes>;
}
