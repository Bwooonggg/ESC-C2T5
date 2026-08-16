import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '..',
  define: {
    'process.env': {}
  },
  server: {
    proxy: {
      '/api/worksheet': {
        target: 'http://localhost:2024',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/worksheet/, ''),
      },
    },
  },
});
