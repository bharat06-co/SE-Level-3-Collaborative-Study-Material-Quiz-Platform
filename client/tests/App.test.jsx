import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import { MemoryRouter } from 'react-router-dom';
import { getHealth } from '../src/api/http';
jest.mock('../src/api/http', () => ({ getHealth: jest.fn() }));
const good = { status: 'ok', checks: { database: 'connected' } };
function renderApp() { return render(<MemoryRouter><App /></MemoryRouter>); }
test('renders honest foundation page and connected health state', async () => {
  getHealth.mockResolvedValue(good);
  renderApp();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Collaborative Study Material');
  expect(await screen.findByText('API and MongoDB are connected.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open quiz authoring' })).toHaveAttribute('href', '/quizzes');
});
test('shows checking and disables retry while waiting', () => {
  getHealth.mockImplementation(() => new Promise(() => {}));
  renderApp();
  expect(screen.getByRole('status')).toHaveTextContent('Checking');
  expect(screen.getByRole('button', { name: 'Check again' })).toBeDisabled();
});
test('shows unavailable state on connection failure and can retry', async () => {
  getHealth.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(good);
  renderApp();
  expect(await screen.findByText(/API or database unavailable/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Check again' }));
  expect(await screen.findByText('API and MongoDB are connected.')).toBeInTheDocument();
  expect(getHealth).toHaveBeenCalledTimes(2);
});
test.each([{ status: 'ok' }, { status: 'not_ready', checks: { database: 'connected' } }])('does not show a false healthy result for %j', async (health) => {
  getHealth.mockResolvedValue(health); renderApp();
  expect(await screen.findByText(/API or database unavailable/)).toBeInTheDocument();
});
test('aborts pending request on unmount', async () => {
  let resolve;
  getHealth.mockImplementation(() => new Promise((done) => { resolve = done; }));
  renderApp();
  const signal = getHealth.mock.calls[0][0].signal;
  cleanup(); resolve(good);
  await waitFor(() => expect(signal.aborted).toBe(true));
});
test('ignores pending failure after unmount', async () => {
  let reject;
  getHealth.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
  renderApp(); cleanup(); reject(new Error('aborted'));
  await Promise.resolve();
});
