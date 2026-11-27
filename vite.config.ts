import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The browser only ever talks to /api/* (our own Express server).
// Vite forwards those calls in dev, so the PayEngine key never reaches the browser.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
});
