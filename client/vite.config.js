import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return { plugins: [react()], server: { port: 5173, strictPort: true, proxy: { '/api': { target: env.DEV_API_TARGET || 'http://127.0.0.1:3000', changeOrigin: true } } } };
});
