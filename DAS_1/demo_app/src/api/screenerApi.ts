import type {
  ApiError,
  ContactDetails,
  ScreenerType,
  ScreeningSession,
} from '../../shared/types'

/**
 * Same-origin gateway prefix, so the browser talks to whatever host serves the
 * app and the proxy (see vite.config.ts) strips /api/screening before
 * forwarding to the DAS 1 backend. An absolute base here would break any setup
 * where the backend is not reachable at that exact host from the browser —
 * WSL, containers, a phone on the LAN.
 */
const API_BASE_URL = '/api/screening'

/**
 * Transport only. Every call returns the server's updated session, which the
 * client treats as the single source of truth.
 */

async function post(url: string, body: unknown): Promise<ScreeningSession> {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const failure = (await response.json().catch(() => null)) as ApiError | null
    throw new Error(failure?.error ?? `Request failed with status ${response.status}.`)
  }

  return (await response.json()) as ScreeningSession
}

export function createSession(screenerType: ScreenerType) {
  return post('/sessions', { screenerType })
}

export function sendMessage(id: string, message: string, notes: string) {
  return post(`/sessions/${id}/messages`, { message, notes })
}

export function recordAnswer(id: string, question: string, answer: string) {
  return post(`/sessions/${id}/responses`, { question, answer })
}

export function requestReport(id: string, notes: string) {
  return post(`/sessions/${id}/report`, { notes })
}

export function submitContact(id: string, contact: ContactDetails) {
  return post(`/sessions/${id}/contact`, contact)
}
