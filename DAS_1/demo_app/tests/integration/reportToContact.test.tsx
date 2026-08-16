import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import ScreenerPage from '../../src/pages/ScreenerPage'
import { server } from '../mocks/server'
import '@testing-library/jest-dom/vitest'

/**
 * IT-24 — the second half of the client journey. IT-11 and IT-12 both stop at
 * the screening stage, so nothing yet exercised ScreenerPage's report and
 * completed branches: that "Engage DAS services" reveals the form, that the
 * form's details reach the contact endpoint, and that the returned session
 * swaps the whole page for the confirmation.
 */

const report = 'Summary: signs consistent with dyslexia. Recommend a full assessment.'
const contact = { name: 'Tan Wei Ling', email: 'wl.tan@example.com', phone: '+65 9123 4567' }

const sessionAtReportStage = {
  id: 'mock-adult-session-id',
  screenerType: 'adult',
  stage: 'report',
  messages: [],
  responses: {},
  notes: '',
  report,
  contact: null,
}

/** Records what the client actually posted to the contact endpoint. */
function stubContactEndpoint() {
  const received: unknown[] = []

  server.use(
    http.post('*/api/screening/sessions', () => HttpResponse.json(sessionAtReportStage)),
    http.post('*/api/screening/sessions/:id/contact', async ({ request }) => {
      const body = await request.json()
      received.push(body)
      return HttpResponse.json({
        ...sessionAtReportStage,
        stage: 'completed',
        contact: body,
      })
    }),
  )

  return received
}

afterEach(() => {
  server.resetHandlers()
})

describe('ScreenerPage at the report stage', () => {
  it('walks report → contact form → confirmation, posting the details once', async () => {
    const user = userEvent.setup()
    const received = stubContactEndpoint()

    render(<ScreenerPage screenerType="adult" />)

    // The report renders, and the chat composer is gone with the screening stage.
    expect(await screen.findByText(report)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument()

    // The form is behind an explicit action, not shown alongside the report.
    expect(screen.queryByLabelText('Name *')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Engage DAS services' }))

    await user.type(screen.getByLabelText('Name *'), contact.name)
    await user.type(screen.getByLabelText('Email *'), contact.email)
    await user.type(screen.getByLabelText('Phone'), contact.phone)
    await user.click(screen.getByRole('button', { name: 'Submit details' }))

    // The completed session replaces the report with the confirmation.
    expect(await screen.findByRole('heading', { name: 'Success' })).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`Thank you, ${contact.name}`))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(contact.email))).toBeInTheDocument()
    expect(screen.queryByText(report)).not.toBeInTheDocument()

    expect(received).toEqual([contact])
  })

  it('keeps the report on screen and shows the error when the contact save fails', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('*/api/screening/sessions', () => HttpResponse.json(sessionAtReportStage)),
      http.post('*/api/screening/sessions/:id/contact', () =>
        HttpResponse.json(
          { error: 'A screening report must exist before DAS services can be engaged.' },
          { status: 409 },
        ),
      ),
    )

    render(<ScreenerPage screenerType="adult" />)

    await user.click(await screen.findByRole('button', { name: 'Engage DAS services' }))
    await user.type(screen.getByLabelText('Name *'), contact.name)
    await user.type(screen.getByLabelText('Email *'), contact.email)
    await user.click(screen.getByRole('button', { name: 'Submit details' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'A screening report must exist before DAS services can be engaged.',
    )

    // The user keeps everything they had: report, form, and a live submit button.
    expect(screen.getByText(report)).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Submit details' })).toBeEnabled(),
    )
  })
})
