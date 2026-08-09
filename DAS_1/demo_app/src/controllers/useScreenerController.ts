import { useCallback, useEffect, useRef, useState } from 'react'
import type { ContactDetails, ScreenerType, ScreeningSession } from '../../shared/types'
import * as api from '../api/screenerApi'

/**
 * Client-side Controller. Owns the session, the loading flag, and the error
 * string, and exposes one action per thing the user can do. The views below it
 * render what they are given and call these actions — they hold no flow logic.
 */

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.'
}

export function useScreenerController(screenerType: ScreenerType) {
  const [session, setSession] = useState<ScreeningSession | null>(null)
  const [notes, setNotes] = useState('')
  const [showContactForm, setShowContactForm] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // StrictMode runs effects twice in dev; without this the server would open
  // two sessions and the second would orphan the first.
  const hasStarted = useRef(false)

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true

    api
      .createSession(screenerType)
      .then(setSession)
      .catch((err: unknown) => setError(messageOf(err)))
      .finally(() => setIsLoading(false))
  }, [screenerType])

  const run = useCallback(
    async (action: (id: string) => Promise<ScreeningSession>) => {
      if (!session) return

      setError('')
      setIsLoading(true)
      try {
        setSession(await action(session.id))
      } catch (err) {
        setError(messageOf(err))
      } finally {
        setIsLoading(false)
      }
    },
    [session],
  )

  const sendMessage = useCallback(
    (message: string) => run((id) => api.sendMessage(id, message, notes)),
    [run, notes],
  )

  const answerChecklistQuestion = useCallback(
    (question: string, answer: boolean) =>
      run((id) => api.recordAnswer(id, question, answer ? 'Yes' : 'No')),
    [run],
  )

  const finishScreener = useCallback(
    () => run((id) => api.requestReport(id, notes)),
    [run, notes],
  )

  const submitContact = useCallback(
    (contact: ContactDetails) => run((id) => api.submitContact(id, contact)),
    [run],
  )

  const openContactForm = useCallback(() => setShowContactForm(true), [])

  return {
    session,
    notes,
    setNotes,
    isLoading,
    error,
    showContactForm,
    openContactForm,
    sendMessage,
    answerChecklistQuestion,
    finishScreener,
    submitContact,
  }
}
