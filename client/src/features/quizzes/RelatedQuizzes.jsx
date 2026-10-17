import { useEffect, useState } from 'react';
import { http } from '../../api/http';

export async function findPublishedQuizzesByTopic(topic, { signal } = {}) {
  const items = [];
  let page = 1;
  let total;
  do {
    const response = await http.get('/quizzes', { params: { topic, status: 'published', page, limit: 50 }, signal });
    items.push(...response.data.items);
    total = response.data.total;
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
