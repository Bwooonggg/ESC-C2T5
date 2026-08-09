import React from 'react'

interface QuestionItem {
  id?: string
  text?: string
  question?: string
  options?: string[]
}

interface ChecklistViewProps {
  questions?: QuestionItem[]
  responses?: Record<string, string>
  disabled?: boolean
  onAnswer: (questionId: string, answer: string) => void
}

export default function ChecklistView({
  questions = [],
  responses = {},
  disabled = false,
  onAnswer,
}: ChecklistViewProps) {
  const safeResponses = responses ?? {}

  return (
    <div className="checklist-container">
      <h2 className="checklist-title">Checklist</h2>
      <div className="checklist-group">
        {(questions ?? []).map((q, idx) => {
          const qId = q.id || `q${idx + 1}`
          const questionText = q.question || q.text || ''
          const selectedOption = safeResponses[qId] || safeResponses[q.id || '']

          return (
            <fieldset key={qId} className="checklist-item">
              <legend className="checklist-question">{questionText}</legend>
              <div className="checklist-options">
                {(q.options ?? ['Yes', 'No']).map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name={qId}
                      value={option}
                      checked={selectedOption === option}
                      disabled={disabled}
                      onChange={() => onAnswer(qId, option)}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          )
        })}
      </div>
    </div>
  )
}