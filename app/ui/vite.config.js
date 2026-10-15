import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the React front end to app/web/, which the Node server (server.mjs)
// serves as static files alongside the /api routes. In dev, vite proxies /api
// to the running backend so there is one origin.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: { outDir: '../web', emptyOutDir: true },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
});
