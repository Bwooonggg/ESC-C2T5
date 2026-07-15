import * as emailProvider from '../services/emailProvider.js'
import type { EmailNotification, Summary } from '../types/domain.js'
import { delay } from '../utils/delay.js'

// `EmailServiceAdapter` from the Notify Parent sequence diagram.

export async function sendNotification(
  summary: Summary,
  recipientEmail: string,
): Promise<EmailNotification> {
  await delay(300)

  const notification: EmailNotification = {
    notificationId: `notif-${summary.studentId}-${Date.now()}`,
    recipientEmail,
    subject: 'Your child’s latest progress summary',
    body: summary.content,
    sentAt: null,
    sent: false,
    summaryId: summary.summaryId,
  }

  const sent = emailProvider.send(notification)

  return { ...notification, sent, sentAt: sent ? new Date().toISOString() : null }
}
