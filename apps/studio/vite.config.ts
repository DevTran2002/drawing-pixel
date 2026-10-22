import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/storage': 'http://127.0.0.1:3055',
      '/api': 'http://127.0.0.1:3055'
    }
  },
  resolve: {
    alias: {
      '@pixel-draw/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts')
    }
  }
});
