import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ChatView from '../../src/views/ChatView'

const baseProps = {
  messages: [],
  intro: 'Tell the assistant what brought you here.',
  placeholder: 'Describe your reading or writing difficulties...',
  disabled: false,
}

// UT-17 — Chat input guards against blank submissions
describe('ChatView', () => {
  it('does not call onSend for a whitespace-only draft, and leaves the draft unchanged', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()

    render(<ChatView {...baseProps} onSend={onSend} />)

    const input = screen.getByPlaceholderText(baseProps.placeholder)
    await user.type(input, '   ')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(onSend).not.toHaveBeenCalled()
    expect(input).toHaveValue('   ')
  })

  it('clears the draft and sends the trimmed text for a valid message', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()

    render(<ChatView {...baseProps} onSend={onSend} />)

    const input = screen.getByPlaceholderText(baseProps.placeholder)
    await user.type(input, '  I mix up letters  ')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith('I mix up letters')
    expect(input).toHaveValue('')
  })
})
