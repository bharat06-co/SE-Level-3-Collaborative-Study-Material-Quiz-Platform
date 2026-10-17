import { render, screen } from '@testing-library/react';
import RelatedQuizzes, { findPublishedQuizzesByTopic } from '../src/features/quizzes/RelatedQuizzes';
import { http } from '../src/api/http';

jest.mock('../src/api/http', () => ({ http: { get: jest.fn() } }));

test('queries published quizzes by shared topic across pages', async () => {
  http.get.mockResolvedValueOnce({ data: { items: [{ id: 'q1' }], total: 2 } })
    .mockResolvedValueOnce({ data: { items: [{ id: 'q2' }], total: 2 } });
  expect(await findPublishedQuizzesByTopic('DBMS')).toEqual([{ id: 'q1' }, { id: 'q2' }]);
  expect(http.get).toHaveBeenNthCalledWith(1, '/quizzes', expect.objectContaining({ params: { topic: 'DBMS', status: 'published', page: 1, limit: 50 } }));
  expect(http.get).toHaveBeenNthCalledWith(2, '/quizzes', expect.objectContaining({ params: { topic: 'DBMS', status: 'published', page: 2, limit: 50 } }));
});

test('shows published topic matches and updates when material topic changes', async () => {
  const findQuizzes = jest.fn().mockResolvedValueOnce([
    { id: 'q1', title: 'DBMS basics' }, { id: 'q2', title: 'Normalisation' },
  ]).mockResolvedValueOnce([]);
  const { rerender } = render(<RelatedQuizzes topic="DBMS" findQuizzes={findQuizzes} />);
  expect(await screen.findByRole('link', { name: 'DBMS basics' })).toHaveAttribute('href', '/quizzes/q1');
  expect(screen.getByRole('link', { name: 'Normalisation' })).toBeInTheDocument();
  expect(findQuizzes).toHaveBeenCalledWith('DBMS', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  rerender(<RelatedQuizzes topic="os" findQuizzes={findQuizzes} />);
  expect(await screen.findByText('No published quizzes for this topic yet.')).toBeInTheDocument();
});

test('handles a material with no topic and a failed request', async () => {
  const findQuizzes = jest.fn().mockRejectedValue(new Error('offline'));
  const { rerender } = render(<RelatedQuizzes topic="" findQuizzes={findQuizzes} />);
  expect(screen.getByText('No topic is available for this material.')).toBeInTheDocument();
  expect(findQuizzes).not.toHaveBeenCalled();
  rerender(<RelatedQuizzes topic="dbms" findQuizzes={findQuizzes} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
});
