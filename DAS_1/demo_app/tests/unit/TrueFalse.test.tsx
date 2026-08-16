import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TrueFalse from '../../src/views/TrueFalse'

/**
 * UT-32..UT-34 — TrueFalse.tsx, named in the first plan's timeline but never
 * given a case. It is a controlled component: it owns no state, so the only
 * things worth asserting are that it renders the session's answer and reports
 * the user's choice as a boolean.
 */

const question = 'Does the child confuse letters that look similar, such as b and d?'

function renderTrueFalse(props: Partial<React.ComponentProps<typeof TrueFalse>> = {}) {
  const onAnswer = vi.fn()
  const view = render(
    <TrueFalse
      question={question}
      value={undefined}
      disabled={false}
      onAnswer={onAnswer}
      {...props}
    />,
  )
  return { ...view, onAnswer }
}

describe('TrueFalse', () => {
  // UT-32 — Unanswered question renders neither option selected
  it('labels the group with the question and leaves both radios unchecked when unanswered', () => {
    renderTrueFalse({ value: undefined })

    const group = screen.getByRole('group', { name: question })
    expect(within(group).getByRole('radio', { name: 'Yes' })).not.toBeChecked()
    expect(within(group).getByRole('radio', { name: 'No' })).not.toBeChecked()
  })

  // UT-33 — Stored answer drives the checked radio, and clicking reports a boolean
  it('reflects the stored answer and reports the opposite choice as a boolean', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderTrueFalse({ value: 'Yes' })

    const yes = screen.getByRole('radio', { name: 'Yes' })
    const no = screen.getByRole('radio', { name: 'No' })
    expect(yes).toBeChecked()
    expect(no).not.toBeChecked()

    await user.click(no)

    // The component is controlled: it reports the change and waits for the
    // session to come back, rather than flipping itself.
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer).toHaveBeenCalledWith(false)
    expect(yes).toBeChecked()
  })

  it('reports true when "Yes" is chosen from an unanswered question', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderTrueFalse({ value: undefined })

    await user.click(screen.getByRole('radio', { name: 'Yes' }))

    expect(onAnswer).toHaveBeenCalledWith(true)
  })

  // UT-34 — Disabled while a save is in flight
  it('disables both radios and reports nothing while disabled', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderTrueFalse({ value: undefined, disabled: true })

    const yes = screen.getByRole('radio', { name: 'Yes' })
    expect(yes).toBeDisabled()

    await user.click(yes)

    expect(onAnswer).not.toHaveBeenCalled()
  })
})
