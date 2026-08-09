import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './mocks/server'

// Provide default environment fallbacks for database/backend modules during tests
process.env.SUPA_URL = process.env.SUPA_URL || 'http://127.0.0.1:54321'
process.env.SUPA_ANON_KEY = process.env.SUPA_ANON_KEY || 'mock-anon-key'
process.env.SUPA_SECRET_KEY = process.env.SUPA_SECRET_KEY || 'mock-secret-key'

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
  cleanup()
})

afterAll(() => {
  try {
    server.close()
  } catch {
    // Already closed by real-server test suites
  }
})