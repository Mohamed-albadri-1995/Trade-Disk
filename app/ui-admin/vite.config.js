import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The admin dashboard — served at /admin/. Its own app under app/web/admin/.
export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  build: { outDir: '../web/admin', emptyOutDir: true },
  server: { port: 5176, proxy: { '/api': 'http://localhost:8787' } },
});
