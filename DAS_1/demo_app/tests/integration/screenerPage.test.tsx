import React,{ StrictMode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import ScreenerPage from '../../src/pages/ScreenerPage'
import { server } from '../mocks/server'
import '@testing-library/jest-dom/vitest'

function countRequestsMatching(method: string, pathPattern: RegExp): { count: () => number } {
  let count = 0
  const listener = ({ request }: { request: Request }) => {
    const url = new URL(request.url)
    if (request.method === method && pathPattern.test(url.pathname)) count += 1
  }
  server.events.on('request:start', listener)
  return { count: () => count }
}

afterEach(() => {
  server.events.removeAllListeners('request:start')
})

// IT-11 — ScreenerPage + hook wiring against a mocked network
describe('ScreenerPage (child screener) under React StrictMode', () => {
  it('starts exactly one session and re-renders the selected radio on answer', async () => {
    const sessionCreations = countRequestsMatching('POST', /^\/api\/screening\/sessions$/)
    const answerSubmissions = countRequestsMatching(
      'POST',
      /^\/api\/screening\/sessions\/[^/]+\/responses$/,
    )

    render(
      <StrictMode>
        <ScreenerPage screenerType="child" />
      </StrictMode>,
    )

    const question = 'Does the child confuse letters that look similar, such as b and d?'
    const group = await screen.findByRole('group', { name: question })

    // StrictMode double-invokes effects in dev; hasStarted must still gate this to one call.
    expect(sessionCreations.count()).toBe(1)

    const yesRadio = within(group).getByRole('radio', { name: 'Yes' }) as HTMLInputElement
    expect(yesRadio).not.toBeChecked()

    const user = userEvent.setup()
    await user.click(yesRadio)

    await waitFor(() => expect(yesRadio).toBeChecked())
    expect(answerSubmissions.count()).toBe(1)
  })
})

// IT-12 — Hook surfaces API failures without crashing the view
describe('ScreenerPage (adult screener) when the message endpoint fails', () => {
  it('renders the alert text instead of throwing, and resets loading state', async () => {
    server.use(
      http.post('*/api/screening/sessions/:id/messages', () =>
        HttpResponse.json({ error: 'Claude is temporarily unavailable.' }, { status: 500 }),
      ),
    )

    render(<ScreenerPage screenerType="adult" />)

    const placeholder = 'Describe your reading or writing difficulties...'
    const input = await screen.findByPlaceholderText(placeholder)

    const user = userEvent.setup()
    await user.type(input, 'I mix up letters when reading')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Claude is temporarily unavailable.')

    // isLoading reset to false: the button is interactive again, not stuck on "Sending...".
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()

    // Session state is whatever it was before the failed call: no message was appended.
    expect(screen.queryByText('I mix up letters when reading')).not.toBeInTheDocument()
  })
})
