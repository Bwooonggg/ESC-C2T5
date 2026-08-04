import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The app calls relative `/api/insights/...` paths. This mirrors what Traefik
    // does in the integrated deployment: match the public prefix, strip it, forward
    // to the service. Because both sides strip, the backend sees the same root-level
    // paths in dev and in production — see src/config/api.ts.
    proxy: {
      '/api/insights': {
        target: 'http://localhost:4000',
        rewrite: (path) => path.replace(/^\/api\/insights/, ''),
      },
    },
  },
})
