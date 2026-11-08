import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    host: '0.0.0.0'
  },
  test: {
    // The full-page render tests are slow on modest machines; the default 5 s limit made
    // otherwise-correct tests time out (different ones each run).
    testTimeout: 30000
  }
});
