import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

/**
 * Runs once per test file (Vitest module isolation re-evaluates config.ts per
 * file), so every test file gets its own throwaway sessions.json and never
 * touches backend/data/sessions.json. Real values from the shell/`.env` win
 * over these dummies, which only exist so importing db.ts doesn't throw for
 * tests that never issue a query (see tests/integration/contact.test.ts for
 * the one that does).
 */
process.env.SESSIONS_FILE = path.join(os.tmpdir(), `das1-test-${randomUUID()}.json`)
process.env.DB_USER ??= 'das1_test_user'
process.env.DB_PASSWORD ??= 'das1_test_password'
process.env.DB_NAME ??= 'das1_test'
process.env.DB_HOST ??= 'localhost'
process.env.SUPA_URL ??= 'http://127.0.0.1:54321'
process.env.SUPA_SECRET_KEY ??= 'mock-secret-key'
