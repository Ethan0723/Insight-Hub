import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: '/Insight-Hub/',
  server:
    mode === 'development'
      ? {
          proxy: {
            '/api': {
              target: 'http://localhost:8787',
              changeOrigin: true
            }
          }
        }
      : undefined
}));
