import type { EmailNotification } from '../types/domain.js'

// `EmailProvider` from the Notify Parent sequence diagram — the external email
// server. It logs instead of sending: nothing in this prototype should be
// capable of putting mail in a real person's inbox.

export function send(notification: EmailNotification): boolean {
  console.log(
    `[EmailProvider] to=${notification.recipientEmail} subject="${notification.subject}"`,
  )
  console.log(`[EmailProvider] body: ${notification.body.slice(0, 120)}...`)
  return true
}
