import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    define: {
      __DAS1_API_URL__: JSON.stringify(env.VITE_DAS1_API_URL || '/api/screening'),
      __DAS3_API_URL__: JSON.stringify(env.VITE_DAS3_API_URL || '/api/worksheet'),
      __DAS7_API_URL__: JSON.stringify(env.VITE_DAS7_API_URL || '/api/insights'),
      __USE_STUBS__: JSON.stringify(env.VITE_USE_STUBS === 'true'),
    },
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
  }
})
