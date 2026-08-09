import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Kept separate from vite.config.ts (which carries the dev-only API proxy)
 * because Vitest prefers a dedicated vitest.config.ts when one exists.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    css: false,
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
  },
})
