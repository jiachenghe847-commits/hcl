/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Dev: the worker runs on :8787 (`npm run dev` in apps/worker); /api is proxied to it.
// Production: the worker serves this build as static assets (DECISIONS.md D2).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  test: { environment: 'jsdom' },
});
