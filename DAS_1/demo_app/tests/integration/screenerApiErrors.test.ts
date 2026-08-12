import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import * as api from '../../src/api/screenerApi'
import { server } from '../mocks/server'

/**
 * IT-25 — screenerApi.ts's post() against real HTTP responses.
 *
 * IT-10 proves the happy path and the {error} path against the live Express
 * app. What it cannot easily produce is a response the server never meant to
 * send: an HTML error page from a proxy, an empty body, or a 204. Those are
 * exactly the cases where post()'s `.catch(() => null)` fallback decides
 * whether the user sees a sentence or "undefined".
 */

afterEach(() => {
  server.resetHandlers()
})

describe('screenerApi error decoding', () => {
  it('falls back to a status message when the error body is not JSON', async () => {
    server.use(
      http.post('*/api/sessions', () =>
        HttpResponse.text('<html><body>502 Bad Gateway</body></html>', { status: 502 }),
      ),
    )

    await expect(api.createSession('adult')).rejects.toThrow('Request failed with status 502.')
  })

  it('falls back to a status message when the error body is empty', async () => {
    server.use(
      http.post('*/api/sessions/:id/messages', () => new HttpResponse(null, { status: 503 })),
    )

    await expect(api.sendMessage('any-id', 'hello', '')).rejects.toThrow(
      'Request failed with status 503.',
    )
  })

  it('prefers the server\'s own message whenever the body carries one', async () => {
    server.use(
      http.post('*/api/sessions/:id/report', () =>
        HttpResponse.json({ error: 'The screener produced an empty report.' }, { status: 502 }),
      ),
    )

    await expect(api.requestReport('any-id', '')).rejects.toThrow(
      'The screener produced an empty report.',
    )
  })

  it('sends the contact details as the request body, not wrapped in an envelope', async () => {
    let body: unknown
    server.use(
      http.post('*/api/sessions/:id/contact', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 'any-id', stage: 'completed' })
      }),
    )

    const contact = { name: 'Tan Wei Ling', email: 'wl.tan@example.com', phone: '91234567' }
    await api.submitContact('any-id', contact)

    // The server reads req.body directly in validateContact, so any envelope
    // here would fail validation with "Name is required."
    expect(body).toEqual(contact)
  })
})
