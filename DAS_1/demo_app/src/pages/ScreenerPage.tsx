import type { ScreenerType } from '../../shared/types'
import { useScreenerController } from '../controllers/useScreenerController'
import { SCREENER_CONFIG } from '../screenerConfig'
import ChatView from '../views/ChatView'
import ChecklistView from '../views/ChecklistView'
import ContactFormView from '../views/ContactFormView'
import ReportView from '../views/ReportView'

/**
 * Binds the controller to the views. Both screeners run through here — the
 * config decides which pieces appear.
 */
export default function ScreenerPage({ screenerType }: { screenerType: ScreenerType }) {
  const config = SCREENER_CONFIG[screenerType]
  const {
    session,
    isLoading,
    error,
    showContactForm,
    openContactForm,
    sendMessage,
    answerChecklistQuestion,
    submitContact,
  } = useScreenerController(screenerType)

  if (!session) {
    return (
      <div style={{ maxWidth: '1000px', margin: '2rem auto', padding: '0 1rem' }}>
        {error ? <p role="alert">{error}</p> : <p>Starting screener...</p>}
      </div>
    )
  }

  // Use dynamic questions from session state if present, fallback to static config
  const questions = (session as any).questions ?? config.checklist ?? []

  return (
    <div>
      {session.stage === 'screening' ? (
        <div>
          {questions.length > 0 ? (
            <ChecklistView
              questions={questions as any}
              responses={(session.responses ?? (session as any).answers ?? {}) as any}
              disabled={isLoading}
              onAnswer={(questionId: string, answer: string) => {
                answerChecklistQuestion(questionId, answer as any)
              }}
            />
          ) : null}

          <ChatView
            title={config.title}
            messages={session.messages}
            placeholder={config.placeholder}
            disabled={isLoading}
            onSend={sendMessage}
          />
        </div>
      ) : null}

      {session.stage === 'report' && session.report ? (
        <>
          <ReportView
            report={session.report}
            onEngage={config.collectsContact && !showContactForm ? openContactForm : undefined}
          />
          {showContactForm ? (
            <ContactFormView disabled={isLoading} onSubmit={submitContact} />
          ) : null}
        </>
      ) : null}

      {session.stage === 'completed' ? (
        <section style={{ maxWidth: '1000px', margin: '2rem auto', padding: '0 1rem' }}>
          <h3>Success</h3>
          <p>
            Thank you, {session.contact?.name}. Your details and screening report have been saved,
            and DAS will follow up at {session.contact?.email}.
          </p>
        </section>
      ) : null}

      {error ? <p role="alert" style={{ color: 'red', textAlign: 'center' }}>{error}</p> : null}
    </div>
  )
}