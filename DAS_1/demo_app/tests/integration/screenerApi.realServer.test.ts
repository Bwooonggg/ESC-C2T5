// @vitest-environment node
import '../../../backend/tests/setup/env.ts'

import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { http, passthrough } from 'msw'
import { createApp } from '../../../backend/app.ts'
import * as api from '../../src/api/screenerApi'
import { server as mswServer } from '../mocks/server'

let httpServer: Server
let baseUrl: string
let originalFetch: typeof fetch

beforeAll(async () => {
  const app = createApp()
  httpServer = createServer(app)
  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  const { port } = httpServer.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${port}`

  originalFetch = globalThis.fetch
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    let urlStr =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url

    if (urlStr.startsWith('/')) {
      urlStr = baseUrl + urlStr
    } else {
      urlStr = urlStr.replace(/^http:\/\/(127\.0\.0\.1|localhost):4173/, baseUrl)
    }

    return originalFetch(urlStr, init)
  }) as typeof fetch
})

beforeEach(() => {
  mswServer.use(
    http.all('*', ({ request }) => {
      if (baseUrl && request.url.startsWith(baseUrl)) {
        return passthrough()
      }
    }),
  )
})

afterAll(async () => {
  globalThis.fetch = originalFetch
  await new Promise<void>((resolve, reject) =>
    httpServer.close((error) => (error ? reject(error) : resolve())),
  )
})

describe('screenerApi against a real Express app (no mocks)', () => {
  it('creates a session that matches the shared ScreeningSession shape', async () => {
    const session = await api.createSession('adult')

    expect(session.id).toEqual(expect.any(String))
    expect(session.screenerType).toBe('adult')
    expect(session.stage).toBe('screening')
    expect(session.messages).toEqual([])
    expect(session.responses).toEqual({})
    expect(session.notes).toBe('')
    expect(session.report).toBeNull()
    expect(session.contact).toBeNull()
  })

  it("rejects with the server's exact error string for an unknown session id", async () => {
    const unknownId = '00000000-0000-0000-0000-000000000000'

    await expect(api.sendMessage(unknownId, 'hi', '')).rejects.toThrow(
      `No screening session found with id ${unknownId}.`,
    )
  })
})