import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MaterialForm from '../src/features/materials/MaterialForm';

test('upload form shows inline validation and does not submit invalid data', async () => {
  const user = userEvent.setup();
  const onSubmit = jest.fn();
  render(<MaterialForm onSubmit={onSubmit} />);

  await user.click(screen.getByRole('button', { name: 'Upload' }));

  expect(screen.getByText('Title must be 3–120 characters.')).toBeInTheDocument();
  expect(screen.getByText('Description must be 1–2000 characters.')).toBeInTheDocument();
  expect(screen.getByText('Category is required (maximum 100 characters).')).toBeInTheDocument();
  expect(screen.getByText('Provide 1–10 tags.')).toBeInTheDocument();
  expect(screen.getByText('Choose a file to upload.')).toBeInTheDocument();
  expect(screen.getByText('Confirm you have the rights to share this file.')).toBeInTheDocument();
  expect(screen.getByText('Fix the highlighted fields before saving.')).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();

  await user.type(screen.getByLabelText('Title'), 'Database notes');
  expect(screen.queryByText('Title must be 3–120 characters.')).not.toBeInTheDocument();
});

test('submits a trimmed upload and clears after success', async () => {
  const user = userEvent.setup();
  const onSubmit = jest.fn().mockResolvedValue({ id: 'm1' });
  const onSaved = jest.fn();
  render(<MaterialForm onSubmit={onSubmit} onSaved={onSaved} />);

  await user.type(screen.getByLabelText('Title'), '  Database notes  ');
  await user.type(screen.getByLabelText('Description'), ' Normalisation ');
  await user.type(screen.getByLabelText('Category'), 'Notes');
  await user.type(screen.getByLabelText('Topic'), 'dbms');
  await user.type(screen.getByLabelText(/Tags/), ' DBMS, sql ');
  await user.selectOptions(screen.getByLabelText('Visibility'), 'public');
  await user.upload(screen.getByLabelText(/File/), new File(['pdf'], 'notes.pdf', { type: 'application/pdf' }));
  await user.click(screen.getByLabelText(/I have the rights/));
  await user.click(screen.getByRole('button', { name: 'Upload' }));

  expect(onSubmit).toHaveBeenCalledWith({
    title: 'Database notes',
    description: 'Normalisation',
    category: 'Notes',
    topic: 'dbms',
    tags: ' DBMS, sql ',
    visibility: 'public',
    file: expect.any(File),
  });
  expect(await screen.findByText('Material uploaded.')).toBeInTheDocument();
  expect(onSaved).toHaveBeenCalledWith({ id: 'm1' });
});

test('edit mode validates shared IDs and maps server field errors', async () => {
  const user = userEvent.setup();
  const onSubmit = jest.fn().mockRejectedValue({
    response: { data: { error: { message: 'Validation failed.', details: [{ field: 'title', message: 'Title was rejected.' }] } } },
  });
  render(<MaterialForm mode="edit" initialMaterial={{
    title: 'Old title', description: 'Old', category: 'Notes', topic: 'dbms', tags: ['sql'], visibility: 'private',
  }} onSubmit={onSubmit} onCancel={jest.fn()} />);

  await user.selectOptions(screen.getByLabelText('Visibility'), 'shared');
  await user.type(screen.getByLabelText(/Share with user IDs/), 'bad-id');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(screen.getByText('User IDs must be 24 hexadecimal characters.')).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();

  await user.clear(screen.getByLabelText(/Share with user IDs/));
  await user.type(screen.getByLabelText(/Share with user IDs/), 'aaaaaaaaaaaaaaaaaaaaaaaa');
  await user.upload(screen.getByLabelText(/Replace file/), new File(['pdf'], 'new.pdf', { type: 'application/pdf' }));
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    title: 'Old title', visibility: 'shared', sharedWith: 'aaaaaaaaaaaaaaaaaaaaaaaa', file: expect.any(File),
  }));
  expect(await screen.findByText('Title was rejected.')).toBeInTheDocument();
  expect(screen.getByText('Validation failed.')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Cancel' }));
});
