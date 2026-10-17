import { http } from '../src/api/http';
import { loadPublishedQuizzes } from '../src/features/leaderboard/api';

jest.mock('../src/api/http', () => ({ http: { get: jest.fn() } }));

afterEach(() => jest.clearAllMocks());

test('loads all published quizzes across 51 entries', async () => {
  http.get.mockResolvedValueOnce({ data: { items: Array.from({ length: 50 }, (_, i) => ({ id: `q${i}` })), total: 51 } })
    .mockResolvedValueOnce({ data: { items: [{ id: 'q50' }], total: 51 } });
  expect(await loadPublishedQuizzes()).toHaveLength(51);
  expect(http.get).toHaveBeenNthCalledWith(2, '/quizzes', { params: { status: 'published', limit: 50, page: 2 } });
});

test('stops when an inconsistent later page makes no progress', async () => {
  http.get.mockResolvedValueOnce({ data: { items: [{ id: 'q1' }], total: 2 } })
    .mockResolvedValueOnce({ data: { items: [{ id: 'q1' }], total: 2 } });
  await expect(loadPublishedQuizzes()).rejects.toThrow('no progress');
  expect(http.get).toHaveBeenCalledTimes(2);
});
