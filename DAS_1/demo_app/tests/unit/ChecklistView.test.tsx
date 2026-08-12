import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ChecklistView from '../../src/views/ChecklistView'

/**
 * UT-37..UT-38 — ChecklistView.tsx. Unlike TrueFalse it is defensive by design:
 * it accepts questions keyed by `question` or `text`, with or without an `id`,
 * and answers keyed either way. Those fallbacks are what decide whether a saved
 * answer renders as checked, so they are the cases worth pinning.
 */

const question = 'Does the child confuse letters that look similar, such as b and d?'

describe('ChecklistView', () => {
  // UT-37 — Default Yes/No options report the question id and the chosen label
  it('defaults to Yes/No and reports the question id with the chosen option', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()

    render(
      <ChecklistView
        questions={[{ id: 'q1', question }]}
        responses={{}}
        disabled={false}
        onAnswer={onAnswer}
      />,
    )

    const group = screen.getByRole('group', { name: question })
    expect(within(group).getAllByRole('radio')).toHaveLength(2)

    await user.click(within(group).getByRole('radio', { name: 'Yes' }))

    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer).toHaveBeenCalledWith('q1', 'Yes')
  })

  it('renders custom options when the question supplies them', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()

    render(
      <ChecklistView
        questions={[{ id: 'q1', text: 'How often?', options: ['Never', 'Sometimes', 'Often'] }]}
        onAnswer={onAnswer}
      />,
    )

    const group = screen.getByRole('group', { name: 'How often?' })
    expect(within(group).getAllByRole('radio')).toHaveLength(3)

    await user.click(within(group).getByRole('radio', { name: 'Sometimes' }))

    expect(onAnswer).toHaveBeenCalledWith('q1', 'Sometimes')
  })

  // UT-38 — Positional id fallback, and saved answers render as checked
  it('falls back to positional ids and shows the saved answer as checked', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()

    render(
      <ChecklistView
        questions={[{ question: 'First question' }, { question: 'Second question' }]}
        responses={{ q1: 'Yes' }}
        onAnswer={onAnswer}
      />,
    )

    const first = screen.getByRole('group', { name: 'First question' })
    const second = screen.getByRole('group', { name: 'Second question' })

    // No `id` on either question, so they become q1 and q2 by position.
    expect(within(first).getByRole('radio', { name: 'Yes' })).toBeChecked()
    expect(within(second).getByRole('radio', { name: 'Yes' })).not.toBeChecked()

    await user.click(within(second).getByRole('radio', { name: 'No' }))
    expect(onAnswer).toHaveBeenCalledWith('q2', 'No')
  })

  it('renders an empty checklist without crashing when given no questions', () => {
    render(<ChecklistView onAnswer={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Checklist' })).toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('disables every option while a save is in flight', () => {
    render(
      <ChecklistView questions={[{ id: 'q1', question }]} disabled onAnswer={vi.fn()} />,
    )

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled()
    }
  })
})
