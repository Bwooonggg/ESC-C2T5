import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup/env.ts'],
    coverage: {
      provider: 'v8',
      include: ['models/screeningSession.ts'],
      reporter: ['text', 'html'],
    },
  },
})
