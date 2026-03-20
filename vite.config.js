import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 5173,
    open: true,
  },
});
