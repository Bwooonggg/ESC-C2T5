/**
 * The contract between the client and the server. The server's Model is the
 * source of truth for this shape; the client treats it as read-only state.
 */

export type ScreenerType = 'adult' | 'child'

/** Domain stages. Whether the contact form is *visible* is a View concern. */
export type SessionStage = 'screening' | 'report' | 'completed'

export type ChatRole = 'user' | 'assistant'

export type ChatMessage = {
  role: ChatRole
  content: string
}

/** Answers to the fixed yes/no checklist, keyed by question text. */
export type ScreenerResponses = Record<string, string>

export type ContactDetails = {
  name: string
  email: string
  phone: string
}

export type ScreeningSession = {
  id: string
  screenerType: ScreenerType
  stage: SessionStage
  messages: ChatMessage[]
  responses: ScreenerResponses
  notes: string
  report: string | null
  contact: ContactDetails | null
  createdAt: string
  updatedAt: string
}

export type ApiError = {
  error: string
}
