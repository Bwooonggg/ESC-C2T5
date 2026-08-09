type TrueFalseProps = {
  question: string
  /** 'Yes', 'No', or undefined when unanswered. Owned by the session. */
  value: string | undefined
  disabled: boolean
  onAnswer: (value: boolean) => void
}

export default function TrueFalse({ question, value, disabled, onAnswer }: TrueFalseProps) {
  return (
    <fieldset disabled={disabled}>
      <legend>{question}</legend>
      <label>
        <input
          type="radio"
          name={question}
          checked={value === 'Yes'}
          onChange={() => onAnswer(true)}
        />
        Yes
      </label>
      <label>
        <input
          type="radio"
          name={question}
          checked={value === 'No'}
          onChange={() => onAnswer(false)}
        />
        No
      </label>
    </fieldset>
  )
}
