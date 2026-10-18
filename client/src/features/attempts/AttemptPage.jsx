import { useEffect, useRef, useState } from 'react';
import { loadAttemptQuiz, submitAttempt, parseQuiz, parseAttemptResult } from './attemptApi';
import AttemptResults from './AttemptResults';
import './attempts.css';
function errorMessage(error, submitting = false) {
  const status = error.response?.status;
  const code = error.response?.data?.error?.code;
  if (status === 401) return 'Sign in with your student account to attempt this quiz. Authentication must be connected by the team.';
  if (status === 403) return 'Only students, including student contributors, can submit attempts.';
  if (status === 404) return 'This quiz is unavailable. It may be missing, unpublished, or not yet integrated.';
  if (status === 409 || code === 'RETAKE_NOT_ALLOWED') return 'You have already submitted this quiz and another attempt is not allowed.';
  if (status === 400) return 'The quiz or answers are invalid. Reload the quiz before trying again.';
  return submitting ? 'The submission could not be confirmed. It may already have been saved. Do not repeatedly resubmit; check with the team before retrying.' : 'The quiz could not be loaded. Please try again.';
}
function AttemptSession({ quizId, loadQuiz = loadAttemptQuiz, sendAttempt = submitAttempt }) {
  const [quiz, setQuiz] = useState(null);
  const [responses, setResponses] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [reload, setReload] = useState(0);
  const lock = useRef(false);
  const generation = useRef(0);
  const submissionController = useRef(null);
  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    setLoading(true); setError(''); setQuiz(null); setResult(null); setResponses({}); setBlocked(false);
    loadQuiz(quizId, { signal: controller.signal }).then(data => {
      if (current === generation.current) setQuiz(parseQuiz(data, quizId));
    }).catch(err => { if (current === generation.current) setError(errorMessage(err)); })
      .finally(() => { if (current === generation.current) setLoading(false); });
    return () => { generation.current += 1; controller.abort(); submissionController.current?.abort(); };
  }, [quizId, loadQuiz, reload]);
  async function handleSubmit(event) {
    event.preventDefault();
    if (!quiz || lock.current || blocked) return;
    lock.current = true; setSubmitting(true); setError('');
    const current = generation.current;
    const controller = new AbortController(); submissionController.current = controller;
    const snapshot = { ...responses };
    const answers = quiz.questions.filter(q => snapshot[q.id] !== undefined && snapshot[q.id] !== null).map(q => ({ questionId: q.id, response: snapshot[q.id] }));
    try {
      const saved = await sendAttempt(quizId, answers, { signal: controller.signal });
      if (current === generation.current) setResult(parseAttemptResult(saved, quiz));
    } catch (err) {
      if (current === generation.current) {
        setError(errorMessage(err, true));
        if (err.response?.status === 409) setBlocked(true);
      }
    } finally {
      if (current === generation.current) { setSubmitting(false); lock.current = false; }
    }
  }
  const answered = Object.values(responses).filter(value => value !== null && value !== undefined).length;
  return <main className="attempt-shell">
    <a href="/" className="attempt-back">Platform home</a>
    <p className="eyebrow">QUIZ · ATTEMPT & FEEDBACK</p>
    <h1>{quiz ? quiz.title : 'Attempt quiz'}</h1>
    {loading && <p role="status">Loading published quiz…</p>}
    {error && <p role="alert" className="attempt-error">{error}</p>}
    {!loading && !quiz && <button type="button" onClick={() => setReload(value => value + 1)}>Try loading again</button>}
    {quiz && <>
      <p className="attempt-topic">Topic: {quiz.topic}</p>
      {result ? <AttemptResults quiz={quiz} result={result} responses={responses} onAgain={() => setReload(value => value + 1)} /> : <form onSubmit={handleSubmit}>
        <p>{answered} of {quiz.questions.length} answered. Blank answers receive 0 points.</p>
        <p>{quiz.allowRetake ? 'Retakes are allowed.' : 'One attempt only. Review your answers before submitting.'}</p>
        <ol className="attempt-questions">
          {quiz.questions.map((question, index) => <li key={question.id}>
            <fieldset disabled={submitting || blocked} className="attempt-question">
              <legend>{index + 1}. {question.text}</legend>
              {(question.type === 'mcq' ? question.options.map((text, value) => ({ text, value })) : [{ text: 'True', value: true }, { text: 'False', value: false }]).map(option => <label key={String(option.value)} className="attempt-option">
                <input type="radio" name={`answer-${question.id}`} checked={responses[question.id] === option.value} onChange={() => setResponses(current => ({ ...current, [question.id]: option.value }))} />
                <span>{option.text}</span>
              </label>)}
              <button type="button" className="attempt-clear" disabled={responses[question.id] === undefined || responses[question.id] === null} onClick={() => setResponses(current => ({ ...current, [question.id]: null }))}>Clear answer for question {index + 1}</button>
            </fieldset>
          </li>)}
        </ol>
        <button type="submit" disabled={submitting || blocked}>{submitting ? 'Submitting…' : 'Submit attempt'}</button>
        {submitting && <p role="status">Saving and scoring your attempt…</p>}
      </form>}
    </>}
  </main>;
}
// A different quiz is a fresh session. Pending old results cannot cross identities.
export default function AttemptPage(props) { return <AttemptSession key={props.quizId} {...props} />; }
