import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from '../src/api/http';
import MaterialSignIn from '../src/features/materials/MaterialSignIn';

jest.mock('../src/api/http', () => ({ http: { post: jest.fn() } }));

test('shows inline field validation before calling the login endpoint', async () => {
  const user = userEvent.setup();
  render(<MaterialSignIn onSignedIn={jest.fn()} />);

  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByText('Email is required.')).toBeInTheDocument();
  expect(screen.getByText('Password is required.')).toBeInTheDocument();
  expect(http.post).not.toHaveBeenCalled();

  await user.type(screen.getByLabelText('Email'), 'bad-email');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
  expect(http.post).not.toHaveBeenCalled();
});
