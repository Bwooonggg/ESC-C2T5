import type { EmailNotification } from '../../../domain/entities/email-notification.js'

export interface EmailNotificationRepository {
    findById(notificationId: string): Promise<EmailNotification | null>
    findPending(limit: number): Promise<readonly EmailNotification[]>
    save(notification: EmailNotification): Promise<void>
}
