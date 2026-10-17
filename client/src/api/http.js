import axios from 'axios';
// Same-origin /api/v1 in Docker; Vite proxies this path during development.
// Authentication/refresh behavior belongs to Anisha's reviewed auth work.
export const http = axios.create({ baseURL: '/api/v1', withCredentials: true, timeout: 10000 });
export async function getHealth({ signal } = {}) {
  const response = await http.get('/health', { signal });
  return response.data;
}
