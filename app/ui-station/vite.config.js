import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Station launcher — the home page at /. Builds to app/web/ (the root) with
// emptyOutDir:false so the journal/ and radar/ subdirs are NOT wiped; the Station
// owns index.html + its own assets/ at the root. In dev, vite proxies /api.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: { outDir: '../web', emptyOutDir: false },
  server: { port: 5175, proxy: { '/api': 'http://localhost:8787' } },
});
