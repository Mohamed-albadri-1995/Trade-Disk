import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// TradeLab front end (React + Vite). Builds to app/web/lab/, served at /lab/ by
// the Node server (server.mjs) alongside the /api routes. Its own app folder so
// rebuilding it never touches another tool. In dev, vite proxies /api to the backend.
export default defineConfig({
  plugins: [react()],
  base: '/lab/',
  build: { outDir: '../web/lab', emptyOutDir: true },
  server: { port: 5175, proxy: { '/api': 'http://localhost:8787' } },
});
