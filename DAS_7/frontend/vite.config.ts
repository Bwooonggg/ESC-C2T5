import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The app calls relative `/api/...` paths; this forwards them to the mock
    // backend in dev. Keeps API routing and environment variables out of the frontend
    // entirely — see src/config/api.ts.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
