import { useEffect, useState } from 'react';
import { http } from '../../api/http';

export async function findPublishedQuizzesByTopic(topic, { signal } = {}) {
  const items = [];
  const seen = new Set();
  let page = 1;
  let total;
  do {
    const response = await http.get('/quizzes', { params: { topic, status: 'published', page, limit: 50 }, signal });
    if (!Array.isArray(response.data.items)) throw new Error('Invalid quiz page.');
    const before = seen.size;
    for (const quiz of response.data.items) {
      if (!seen.has(quiz.id)) { seen.add(quiz.id); items.push(quiz); }
    }
    total = response.data.total;
    if (items.length < total && seen.size === before) throw new Error('Related quiz pages made no progress.');
    page += 1;
  } while (items.length < total);
  return items;
}

export default function RelatedQuizzes({ topic, findQuizzes = findPublishedQuizzesByTopic, quizHref = (id) => `/quizzes/${id}` }) {
  const [quizzes, setQuizzes] = useState([]);
  const [state, setState] = useState('loading');

  useEffect(() => {
    if (!topic?.trim()) {
      setQuizzes([]);
      setState('empty');
      return undefined;
    }
    const controller = new AbortController();
    let active = true;
    setState('loading');
    findQuizzes(topic.trim(), { signal: controller.signal }).then((items) => {
      if (active) { setQuizzes(items); setState('ready'); }
    }).catch(() => { if (active) setState('error'); });
    return () => { active = false; controller.abort(); };
  }, [topic, findQuizzes]);

  return (
    <section aria-labelledby="related-quizzes-title">
      <h2 id="related-quizzes-title">Related quizzes</h2>
      {state === 'loading' && <p role="status">Loading related quizzes…</p>}
      {state === 'error' && <p role="alert">Related quizzes could not be loaded.</p>}
      {state === 'empty' && <p>No topic is available for this material.</p>}
      {state === 'ready' && (quizzes.length ? (
        <ul>{quizzes.map((quiz) => <li key={quiz.id}><a href={quizHref(quiz.id)}>{quiz.title}</a></li>)}</ul>
      ) : <p>No published quizzes for this topic yet.</p>)}
    </section>
  );
}
