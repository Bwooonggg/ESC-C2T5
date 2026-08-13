import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ChatView from '../../src/views/ChatView'

/**
 * UT-39..UT-40 — the two ChatView branches UT-17 did not reach: the placeholder
 * greeting shown before the first server message arrives, and the `disabled`
 * guard inside handleSubmit.
 */

describe('ChatView default greeting', () => {
  // UT-39 — The greeting follows the screener named in the title
  it('greets an adult user when the title is the adult screener', () => {
    render(<ChatView title="Adult Screener" messages={[]} onSend={vi.fn()} />)

    expect(screen.getByText(/welcome to the adult screener/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Adult Screener' })).toBeInTheDocument()
  })

  it('greets a caregiver when the title is the child screener', () => {
    render(<ChatView title="Child Screener" messages={[]} onSend={vi.fn()} />)

    expect(screen.getByText(/welcome to the child screener/i)).toBeInTheDocument()
  })

  it('drops the greeting as soon as the session has real messages', () => {
    render(
      <ChatView
        title="Adult Screener"
        messages={[{ role: 'assistant', content: 'How long have you noticed this?' }]}
        onSend={vi.fn()}
      />,
    )

    expect(screen.queryByText(/welcome to the adult screener/i)).not.toBeInTheDocument()
    expect(screen.getByText('How long have you noticed this?')).toBeInTheDocument()
  })
})

describe('ChatView while disabled', () => {
  // UT-40 — A submit that slips past the disabled button is still refused
  it('refuses to send a typed draft once disabled, and keeps the draft', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    const placeholder = 'Describe your reading or writing difficulties...'

    const { container, rerender } = render(
      <ChatView placeholder={placeholder} disabled={false} onSend={onSend} />,
    )

    const input = screen.getByPlaceholderText(placeholder)
    await user.type(input, 'I mix up letters')

    // A reply is now in flight, so the page disables the composer.
    rerender(<ChatView placeholder={placeholder} disabled onSend={onSend} />)

    // Submit the form directly: clicking the disabled button would prove
    // nothing about the guard inside handleSubmit (Enter in a text input, or an
    // assistive technology, can still submit).
    fireEvent.submit(container.querySelector('form')!)

    expect(onSend).not.toHaveBeenCalled()
    // The draft survives, so the user does not retype it after the reply lands.
    expect(input).toHaveValue('I mix up letters')
  })

  it('greys out the input and the send button while disabled', () => {
    render(<ChatView placeholder="Type here" disabled onSend={vi.fn()} />)

    expect(screen.getByPlaceholderText('Type here')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })
})
