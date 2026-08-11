import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/insights': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/insights/, ''),
      },
      '/api/screening': {
        target: 'http://127.0.0.1:4173',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/screening/, ''),
      },
      '/api/worksheet': {
        target: 'http://localhost:2024',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/worksheet/, ''),
      },
    },
  },
})
