import PlainText from '../../components/PlainText';
function answerText(question, response) {
  if (response === null || response === undefined) return 'Not answered';
  return question.type === 'mcq' ? question.options[response] : response ? 'True' : 'False';
}
export default function AttemptResults({ quiz, result, responses, onAgain }) {
  const rows = new Map(result.results.map(row => [row.questionId, row]));
  return (
    <section aria-labelledby="attempt-results-title" className="attempt-results">
      <div className="attempt-score" role="status" aria-live="polite">
        <p className="eyebrow">ATTEMPT SAVED</p>
        <h2 id="attempt-results-title">Your results</h2>
        <p className="attempt-score-value">{result.score}/{result.maxScore}</p>
        <p>{result.percentage}% · Scored on the server</p>
      </div>
      <p>Submitted <time dateTime={result.submittedAt}>{new Date(result.submittedAt).toLocaleString()}</time></p>
      <ol className="attempt-questions">
        {quiz.questions.map((question, index) => {
          const row = rows.get(question.id);
          const label = row.unanswered ? 'Unanswered' : row.isCorrect ? 'Correct' : 'Incorrect';
          return <li key={question.id} className="attempt-feedback">
            <h3>{index + 1}. <PlainText value={question.text} /></h3>
            <p className={`attempt-mark attempt-mark-${label.toLowerCase()}`}>{label}</p>
            <p>Your answer: <strong><PlainText value={answerText(question, responses[question.id])} /></strong></p>
            <p>Correct answer: <strong><PlainText value={answerText(question, row.correctAnswer)} /></strong></p>
          </li>;
        })}
      </ol>
      {quiz.allowRetake ? <button type="button" onClick={onAgain}>Start another attempt</button> : <p>This quiz does not allow another attempt.</p>}
    </section>
  );
}
