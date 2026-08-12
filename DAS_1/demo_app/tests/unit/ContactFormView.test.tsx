import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ContactFormView from '../../src/views/ContactFormView'

/**
 * UT-35..UT-36 — ContactFormView.tsx. This is the last screen before the
 * session is written to Supabase, so an accidental submit with a half-filled
 * form is the expensive failure. The server re-validates (UT-13..UT-15,
 * UT-28..UT-31); these cases cover the client-side guard in front of it.
 */

function renderForm(disabled = false) {
  const onSubmit = vi.fn()
  const view = render(<ContactFormView disabled={disabled} onSubmit={onSubmit} />)
  return { ...view, onSubmit }
}

describe('ContactFormView', () => {
  // UT-35 — Submitting without the required fields does nothing
  it('does not submit when the name is blank', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.type(screen.getByLabelText('Email *'), 'wl.tan@example.com')
    await user.click(screen.getByRole('button', { name: 'Submit details' }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not submit when the email is blank', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.type(screen.getByLabelText('Name *'), 'Tan Wei Ling')
    await user.click(screen.getByRole('button', { name: 'Submit details' }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  // UT-36 — A complete form hands all three fields up
  it('submits name, email and phone exactly as typed', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.type(screen.getByLabelText('Name *'), 'Tan Wei Ling')
    await user.type(screen.getByLabelText('Email *'), 'wl.tan@example.com')
    await user.type(screen.getByLabelText('Phone'), '+65 9123 4567')
    await user.click(screen.getByRole('button', { name: 'Submit details' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Tan Wei Ling',
      email: 'wl.tan@example.com',
      phone: '+65 9123 4567',
    })
  })

  it('treats phone as optional on the client, leaving the rule to the server', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.type(screen.getByLabelText('Name *'), 'Tan Wei Ling')
    await user.type(screen.getByLabelText('Email *'), 'wl.tan@example.com')
    await user.click(screen.getByRole('button', { name: 'Submit details' }))

    // The server rejects this with "A valid phone number is required." (UT-14);
    // the client does not pre-empt it, so the field is only labelled "Phone".
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Tan Wei Ling',
      email: 'wl.tan@example.com',
      phone: '',
    })
  })

  it('disables every field and the submit button while a save is in flight', () => {
    renderForm(true)

    expect(screen.getByLabelText('Name *')).toBeDisabled()
    expect(screen.getByLabelText('Email *')).toBeDisabled()
    expect(screen.getByLabelText('Phone')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Submit details' })).toBeDisabled()
  })
})
