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
  await user.selectOptions(screen.getByLabelText('Correct option'), '1');
  await user.click(screen.getByRole('button', { name: 'Add question' }));
  await user.selectOptions(screen.getAllByLabelText('Type')[1], 'true_false');
  await user.type(screen.getAllByLabelText('Question text')[1], 'BCNF is stricter than 3NF.');
  await user.selectOptions(screen.getByLabelText('Correct answer'), 'true');
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

test('edits metadata without replacing hidden answer keys and publishes', async () => {
  const user = userEvent.setup();
  const save = jest.fn().mockResolvedValue({ id: 'q1', status: 'draft' });
  const setPublication = jest.fn().mockResolvedValue({ id: 'q1', status: 'published' });
  render(<QuizEditor initialQuiz={{ id: 'q1', title: 'DBMS basics', topic: 'dbms', status: 'draft', allowRetake: true, questions: [{ id: 'x', text: 'Old question' }] }} save={save} setPublication={setPublication} />);
  expect(screen.getByText('Old question')).toBeInTheDocument();
  await user.clear(screen.getByLabelText('Title'));
  await user.type(screen.getByLabelText('Title'), 'DBMS advanced');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(save).toHaveBeenCalledWith('q1', { title: 'DBMS advanced', topic: 'dbms', allowRetake: true });
  await user.click(screen.getByRole('button', { name: 'Publish' }));
  expect(setPublication).toHaveBeenCalledWith('q1', true);
  expect(await screen.findByText('Quiz published.')).toBeInTheDocument();
});
