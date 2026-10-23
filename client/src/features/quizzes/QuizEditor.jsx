import { useState } from 'react';
import { saveQuiz, setQuizPublication } from './quizApi';
import './quizEditor.css';

const newQuestion = () => ({ text: '', type: 'mcq', options: ['', ''], answerKey: null });

function validate(title, topic, questions) {
  const errors = {};
  if (title.trim().length < 3 || title.trim().length > 120) errors.title = 'Title must be 3–120 characters.';
  if (!topic.trim()) errors.topic = 'Topic is required.';
  questions.forEach((q, index) => {
    if (!q.text.trim()) errors[`question-${index}`] = 'Question text is required.';
    if (q.type === 'mcq') {
      if (q.options.length < 2 || q.options.length > 6 || q.options.some((option) => !option.trim())) {
        errors[`options-${index}`] = 'Provide 2–6 nonempty options.';
      }
      if (!Number.isInteger(q.answerKey) || q.answerKey < 0 || q.answerKey >= q.options.length) errors[`answer-${index}`] = 'Choose the correct option.';
    } else if (typeof q.answerKey !== 'boolean') {
      errors[`answer-${index}`] = 'Choose true or false.';
    }
  });
  return errors;
}

function QuizEditorForm({ initialQuiz, onSaved, onPublicationChange, save = saveQuiz, setPublication = setQuizPublication }) {
  const [id, setId] = useState(initialQuiz?.id || null);
  const [status, setStatus] = useState(initialQuiz?.status || 'draft');
  const [title, setTitle] = useState(initialQuiz?.title || '');
  const [topic, setTopic] = useState(initialQuiz?.topic || '');
  const [allowRetake, setAllowRetake] = useState(initialQuiz?.allowRetake ?? true);
  const [replaceQuestions, setReplaceQuestions] = useState(!initialQuiz);
  const [questions, setQuestions] = useState([]);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  function changeQuestion(index, patch) {
    setDirty(true);
    setQuestions((current) => current.map((q, i) => i === index ? { ...q, ...patch } : q));
  }
  function changeType(index, type) {
    changeQuestion(index, type === 'mcq'
      ? { type, options: ['', ''], answerKey: null }
      : { type, options: undefined, answerKey: null });
  }
  function payload() {
    return {
      title: title.trim(), topic: topic.trim(), allowRetake,
      ...(replaceQuestions ? { questions: questions.map((q) => q.type === 'mcq'
        ? { text: q.text.trim(), type: q.type, options: q.options.map((option) => option.trim()), answerKey: q.answerKey }
        : { text: q.text.trim(), type: q.type, answerKey: q.answerKey }) } : {}),
    };
  }
  async function handleSave(event) {
    event.preventDefault();
    setMessage('');
    const nextErrors = validate(title, topic, replaceQuestions ? questions : []);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    try {
      const saved = await save(id, payload());
      setId(saved.id);
      setStatus(saved.status);
      setDirty(false);
      setMessage('Quiz saved.');
      onSaved?.(saved);
    } catch (error) {
      setMessage(error.response?.data?.error?.message || 'Quiz could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  async function changePublication(publish) {
    setBusy(true);
    setMessage('');
    try {
      const result = await setPublication(id, publish);
      setStatus(result.status);
      setMessage(publish ? 'Quiz published.' : 'Quiz unpublished.');
      onPublicationChange?.(result);
    } catch (error) {
      setMessage(error.response?.data?.error?.message || 'Publication could not be changed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="quiz-editor" aria-labelledby="quiz-editor-title">
      <h1 id="quiz-editor-title">{id ? 'Edit quiz' : 'Create quiz'}</h1>
      {id && <p>Quiz ID: <code>{id}</code></p>}
      <p>Current status: <strong>{status}</strong></p>
      <form onSubmit={handleSave} noValidate aria-label="Quiz editor" aria-busy={busy}>
        <fieldset className="quiz-editor-form-fields" disabled={busy}>
          <label>Title
            <input value={title} onChange={(event) => { setTitle(event.target.value); setDirty(true); }} aria-invalid={Boolean(errors.title)} />
            {errors.title && <span role="alert">{errors.title}</span>}
          </label>
          <label>Topic
            <input value={topic} onChange={(event) => { setTopic(event.target.value); setDirty(true); }} aria-invalid={Boolean(errors.topic)} />
            {errors.topic && <span role="alert">{errors.topic}</span>}
          </label>
          <label className="quiz-editor-check"><input type="checkbox" checked={allowRetake} onChange={(event) => { setAllowRetake(event.target.checked); setDirty(true); }} />Allow retakes</label>
          {initialQuiz && !replaceQuestions && (
            <section>
              <h2>Questions</h2>
              <p>Existing answer keys are hidden in quiz responses. Replace all questions to enter new keys.</p>
              <ol>{initialQuiz.questions?.map((q) => <li key={q.id}>{q.text}</li>)}</ol>
              <button type="button" onClick={() => { setReplaceQuestions(true); setDirty(true); }}>Replace questions</button>
            </section>
          )}
          {replaceQuestions && (
            <section aria-labelledby="questions-title">
              <h2 id="questions-title">Questions</h2>
              {questions.map((q, index) => (
                <fieldset key={index}>
                  <legend>Question {index + 1}</legend>
                  <label>Question text
                    <input value={q.text} onChange={(event) => changeQuestion(index, { text: event.target.value })} aria-invalid={Boolean(errors[`question-${index}`])} />
                    {errors[`question-${index}`] && <span role="alert">{errors[`question-${index}`]}</span>}
                  </label>
                  <label>Type
                    <select value={q.type} onChange={(event) => changeType(index, event.target.value)}>
                      <option value="mcq">Multiple choice</option><option value="true_false">True or false</option>
                    </select>
                  </label>
                  {q.type === 'mcq' ? (
                    <div>
                      {q.options.map((option, optionIndex) => (
                        <label key={optionIndex}>Option {optionIndex + 1}
                          <input value={option} onChange={(event) => changeQuestion(index, { options: q.options.map((value, i) => i === optionIndex ? event.target.value : value) })} />
                        </label>
                      ))}
                      {errors[`options-${index}`] && <span role="alert">{errors[`options-${index}`]}</span>}
                      <button type="button" disabled={q.options.length >= 6} onClick={() => changeQuestion(index, { options: [...q.options, ''] })}>Add option</button>
                      <button type="button" disabled={q.options.length <= 2} onClick={() => changeQuestion(index, { options: q.options.slice(0, -1), answerKey: q.answerKey === q.options.length - 1 ? null : q.answerKey })}>Remove last option</button>
                      <label>Correct option
                        <select value={q.answerKey ?? ''} onChange={(event) => changeQuestion(index, { answerKey: event.target.value === '' ? null : Number(event.target.value) })}>
                          <option value="">Choose an option</option>
                          {q.options.map((_, optionIndex) => <option key={optionIndex} value={optionIndex}>Option {optionIndex + 1}</option>)}
                        </select>
                        {errors[`answer-${index}`] && <span role="alert">{errors[`answer-${index}`]}</span>}
                      </label>
                    </div>
                  ) : (
                    <label>Correct answer
                      <select value={q.answerKey === null ? '' : String(q.answerKey)} onChange={(event) => changeQuestion(index, { answerKey: event.target.value === '' ? null : event.target.value === 'true' })}>
                        <option value="">Choose an answer</option>
                        <option value="false">False</option><option value="true">True</option>
                      </select>
                      {errors[`answer-${index}`] && <span role="alert">{errors[`answer-${index}`]}</span>}
                    </label>
                  )}
                  <button type="button" onClick={() => { setQuestions((current) => current.filter((_, i) => i !== index)); setDirty(true); }}>Remove question {index + 1}</button>
                </fieldset>
              ))}
              <button type="button" onClick={() => { setQuestions((current) => [...current, newQuestion()]); setDirty(true); }}>Add question</button>
            </section>
          )}
          <button type="submit">{id ? 'Save changes' : 'Save draft'}</button>
        </fieldset>
      </form>
      {id && <div className="quiz-editor-actions">
        {status === 'draft'
          ? <button type="button" disabled={busy || dirty} onClick={() => changePublication(true)}>Publish</button>
          : <button type="button" disabled={busy || dirty} onClick={() => changePublication(false)}>Unpublish</button>}
        {dirty && <p>Save changes before changing publication status.</p>}
      </div>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}

// Changing quiz identity starts a fresh editor. Unsaved edits in the previous
// quiz are discarded so a save can never target an earlier quiz ID.
export default function QuizEditor(props) {
  return <QuizEditorForm key={props.initialQuiz?.id ?? 'new'} {...props} />;
}
