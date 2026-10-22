import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuizEditor from '../src/features/quizzes/QuizEditor';

test('creates a draft with MCQ and true/false answer keys', async () => {
  const user = userEvent.setup();
  const save = jest.fn().mockResolvedValue({ id: 'q1', status: 'draft' });
  render(<QuizEditor save={save} />);
  await user.type(screen.getByLabelText('Title'), 'DBMS basics');
  await user.type(screen.getByLabelText('Topic'), 'dbms');
  await user.click(screen.getByRole('button', { name: 'Add question' }));
  await user.type(screen.getByLabelText('Question text'), 'Which form?');
  await user.type(screen.getByLabelText('Option 1'), '1NF');
  await user.type(screen.getByLabelText('Option 2'), '2NF');
  await user.selectOptions(screen.getByLabelText(/Correct option/), '1');
  await user.click(screen.getByRole('button', { name: 'Add question' }));
  await user.selectOptions(screen.getAllByLabelText('Type')[1], 'true_false');
  await user.type(screen.getAllByLabelText('Question text')[1], 'BCNF is stricter than 3NF.');
  await user.selectOptions(screen.getByLabelText(/Correct answer/), 'true');
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  expect(save).toHaveBeenCalledWith(null, {
    title: 'DBMS basics', topic: 'dbms', allowRetake: true,
    questions: [
      { text: 'Which form?', type: 'mcq', options: ['1NF', '2NF'], answerKey: 1 },
      { text: 'BCNF is stricter than 3NF.', type: 'true_false', answerKey: true },
    ],
  });
  expect(await screen.findByText('Quiz saved.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
});

test('shows inline validation and keeps invalid drafts local', async () => {
  const user = userEvent.setup();
  const save = jest.fn();
  render(<QuizEditor save={save} />);
  await user.click(screen.getByRole('button', { name: 'Add question' }));
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  expect(screen.getByText('Title must be 3–120 characters.')).toBeInTheDocument();
  expect(screen.getByText('Topic is required.')).toBeInTheDocument();
  expect(screen.getByText('Question text is required.')).toBeInTheDocument();
  expect(screen.getByText('Provide 2–6 nonempty options.')).toBeInTheDocument();
  expect(screen.getByText('Choose the correct option.')).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});

test('edits metadata without replacing hidden answer keys, publishes and unpublishes', async () => {
  const user = userEvent.setup();
  const save = jest.fn().mockResolvedValue({ id: 'q1', status: 'draft' });
  const setPublication = jest.fn()
    .mockResolvedValueOnce({ id: 'q1', status: 'published' })
    .mockResolvedValueOnce({ id: 'q1', status: 'draft' });
  render(<QuizEditor initialQuiz={{ id: 'q1', title: 'DBMS basics', topic: 'dbms', status: 'draft', allowRetake: true, questions: [{ id: 'x', text: 'Old question' }] }} save={save} setPublication={setPublication} />);
  expect(screen.getByText('Old question')).toBeInTheDocument();
  await user.clear(screen.getByLabelText('Title'));
  await user.type(screen.getByLabelText('Title'), 'DBMS advanced');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(save).toHaveBeenCalledWith('q1', { title: 'DBMS advanced', topic: 'dbms', allowRetake: true });
  await user.click(screen.getByRole('button', { name: 'Publish' }));
  expect(setPublication).toHaveBeenCalledWith('q1', true);
  expect(await screen.findByText('Quiz published.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Unpublish' }));
  expect(setPublication).toHaveBeenCalledWith('q1', false);
  expect(await screen.findByText('Quiz unpublished.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
});

async function fillMcq(user) {
  await user.type(screen.getByLabelText('Title'), 'DBMS basics');
  await user.type(screen.getByLabelText('Topic'), 'dbms');
  await user.click(screen.getByRole('button', { name: 'Add question' }));
  await user.type(screen.getByLabelText('Question text'), 'Which form?');
  await user.type(screen.getByLabelText('Option 1'), 'First');
  await user.type(screen.getByLabelText('Option 2'), 'Second');
}

test('clearing an MCQ answer remains missing; explicit option zero is valid', async () => {
  const user = userEvent.setup();
  const save = jest.fn().mockResolvedValue({ id: 'q1', status: 'draft' });
  render(<QuizEditor save={save} />);
  await fillMcq(user);
  await user.selectOptions(screen.getByLabelText(/Correct option/), '1');
  await user.selectOptions(screen.getByLabelText(/Correct option/), '');
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  expect(screen.getByText('Choose the correct option.')).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
  await user.selectOptions(screen.getByLabelText(/Correct option/), '0');
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  expect(save).toHaveBeenCalledWith(null, expect.objectContaining({ questions: [expect.objectContaining({ answerKey: 0 })] }));
});

test('option removal preserves a missing key and clears a removed correct option', async () => {
  const user = userEvent.setup();
  const save = jest.fn();
  render(<QuizEditor save={save} />);
  await fillMcq(user);
  await user.click(screen.getByRole('button', { name: 'Add option' }));
  await user.click(screen.getByRole('button', { name: 'Remove last option' }));
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  expect(screen.getByText('Choose the correct option.')).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Add option' }));
  await user.type(screen.getByLabelText('Option 3'), 'Third');
  await user.selectOptions(screen.getByLabelText(/Correct option/), '2');
  await user.click(screen.getByRole('button', { name: 'Remove last option' }));
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  expect(screen.getByText('Choose the correct option.')).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
  await user.selectOptions(screen.getByLabelText(/Correct option/), '1');
  await user.click(screen.getByRole('button', { name: 'Add option' }));
  await user.type(screen.getByLabelText('Option 3'), 'Third');
  await user.click(screen.getByRole('button', { name: 'Remove last option' }));
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  expect(save).toHaveBeenCalledWith(null, expect.objectContaining({ questions: [expect.objectContaining({ answerKey: 1 })] }));
});

test('clearing true or false remains missing; explicitly choosing false is valid', async () => {
  const user = userEvent.setup();
  const save = jest.fn().mockResolvedValue({ id: 'q1', status: 'draft' });
  render(<QuizEditor save={save} />);
  await user.type(screen.getByLabelText('Title'), 'DBMS basics');
  await user.type(screen.getByLabelText('Topic'), 'dbms');
  await user.click(screen.getByRole('button', { name: 'Add question' }));
  await user.selectOptions(screen.getByLabelText('Type'), 'true_false');
  await user.type(screen.getByLabelText('Question text'), 'True or false?');
  await user.selectOptions(screen.getByLabelText(/Correct answer/), 'true');
  await user.selectOptions(screen.getByLabelText(/Correct answer/), '');
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  expect(screen.getByText('Choose true or false.')).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
  await user.selectOptions(screen.getByLabelText(/Correct answer/), 'false');
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  expect(save).toHaveBeenCalledWith(null, expect.objectContaining({ questions: [expect.objectContaining({ answerKey: false })] }));
});

test('switching quiz identity resets every editor field and save target', async () => {
  const user = userEvent.setup();
  const save = jest.fn().mockResolvedValue({ id: 'b', status: 'draft' });
  const a = { id: 'a', title: 'Quiz A', topic: 'topic-a', status: 'draft', questions: [{ id: 'a1', text: 'Question A' }] };
  const b = { id: 'b', title: 'Quiz B', topic: 'topic-b', status: 'draft', questions: [{ id: 'b1', text: 'Question B' }] };
  const { rerender } = render(<QuizEditor initialQuiz={a} save={save} />);
  await user.type(screen.getByLabelText('Title'), ' unsaved');
  rerender(<QuizEditor initialQuiz={b} save={save} />);
  expect(screen.getByLabelText('Title')).toHaveValue('Quiz B');
  expect(screen.getByLabelText('Topic')).toHaveValue('topic-b');
  expect(screen.getByText('Question B')).toBeInTheDocument();
  expect(screen.queryByText('Question A')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(save).toHaveBeenCalledWith('b', { title: 'Quiz B', topic: 'topic-b', allowRetake: true });
});

test('publication waits for unsaved edits', async () => {
  const user = userEvent.setup();
  const save = jest.fn().mockResolvedValue({ id: 'q1', status: 'draft' });
  const setPublication = jest.fn();
  render(<QuizEditor initialQuiz={{ id: 'q1', title: 'Quiz one', topic: 'dbms', status: 'draft' }} save={save} setPublication={setPublication} />);
  await user.type(screen.getByLabelText('Title'), ' edited');
  expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
  expect(screen.getByText('Save changes before changing publication status.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByText('Quiz saved.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled();
  expect(setPublication).not.toHaveBeenCalled();
});
