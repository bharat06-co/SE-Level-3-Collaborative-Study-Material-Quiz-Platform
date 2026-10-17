import { getHealth, http } from '../src/api/http';
test('uses documented API base and returns response data', async () => {
  const spy = jest.spyOn(http, 'get').mockResolvedValue({ data: { status: 'ok' } });
  const controller = new AbortController();
  expect(http.defaults.baseURL).toBe('/api/v1');
  expect(http.defaults.withCredentials).toBe(true);
  await expect(getHealth({ signal: controller.signal })).resolves.toEqual({ status: 'ok' });
  expect(spy).toHaveBeenCalledWith('/health', { signal: controller.signal });
  await getHealth();
  spy.mockRestore();
});
