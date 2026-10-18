import { Routes, Route, useParams, Link } from 'react-router-dom';
import App from './App';
import AttemptPage from './features/attempts/AttemptPage';
function AttemptRoute() { const { quizId } = useParams(); return <AttemptPage quizId={quizId} />; }
export default function AppRoutes() {
  return <Routes>
    <Route path="/" element={<App />} />
    <Route path="/quizzes/:quizId/attempt" element={<AttemptRoute />} />
    <Route path="*" element={<main className="shell"><h1>Page not found</h1><Link to="/">Platform home</Link></main>} />
  </Routes>;
}
