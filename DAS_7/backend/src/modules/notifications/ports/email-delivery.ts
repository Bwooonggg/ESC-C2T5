import type { EmailNotification } from '../../../domain/entities/email-notification.js'

export interface EmailDeliveryResult {
    readonly providerMessageId?: string
}

export interface EmailDeliveryPort {
    send(notification: EmailNotification): Promise<EmailDeliveryResult>
}
