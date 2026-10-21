import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Journal front end (React + Vite). Builds to app/web/journal/, which the Node
// server (server.mjs) serves at /journal/ alongside the /api routes. Each tool is
// its own app under app/web/<tool>/ so rebuilding one never wipes another; the
// Station launcher owns the root. In dev, vite proxies /api to the running backend.
export default defineConfig({
  plugins: [react()],
  base: '/journal/',
  build: { outDir: '../web/journal', emptyOutDir: true },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
});
