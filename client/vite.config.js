import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // In development the browser talks to Vite, which forwards /api to the Express server.
    proxy: {
      '/api': { target: process.env.API_PROXY_TARGET || 'http://localhost:5000', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
    // The app loads pages lazily; the first run after a code change spends seconds transforming them.
    testTimeout: 20000,
  },
});
