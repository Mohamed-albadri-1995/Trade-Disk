import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Radar front end (React + Vite). Builds to app/web/radar/, which the Node
// server (server.mjs) serves at /radar/ alongside the /api routes. Its own app
// under app/web/radar/ so rebuilding it never touches the Journal. In dev, vite
// proxies /api to the running backend so there is one origin.
export default defineConfig({
  plugins: [react()],
  base: '/radar/',
  build: { outDir: '../web/radar', emptyOutDir: true },
  server: { port: 5174, proxy: { '/api': 'http://localhost:8787' } },
});
