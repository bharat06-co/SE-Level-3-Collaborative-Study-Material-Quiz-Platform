import { http } from '../../api/http';

export async function requestPasswordReset(email) {
  const response = await http.post('/auth/forgot-password', { email });
  return response.data;
}

export async function resetPassword(token, password) {
  const response = await http.post('/auth/reset-password', {
    token,
    password,
  });
  return response.data;
}