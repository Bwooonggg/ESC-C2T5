import {
    requireBoolean,
    requireOptionalDate,
    requireText,
} from './entity-validation.js'

export interface EmailNotificationProps {
    readonly notificationId: string
    readonly parentId: string
    readonly summaryId: string
    readonly recipientEmail: string
    readonly subject: string
    readonly body: string
    readonly sentAt: Date | null
    readonly sent: boolean
}

export class EmailNotification {
    readonly notificationId: string
    readonly parentId: string
    readonly summaryId: string
    readonly recipientEmail: string
    readonly subject: string
    readonly body: string
    readonly sentAt: Date | null
    readonly sent: boolean

    constructor(props: EmailNotificationProps) {
        this.notificationId = requireText(
            props.notificationId,
            'notificationId',
        )
        this.parentId = requireText(props.parentId, 'parentId')
        this.summaryId = requireText(props.summaryId, 'summaryId')
        this.recipientEmail = requireText(
            props.recipientEmail,
            'recipientEmail',
        )
        this.subject = requireText(props.subject, 'subject')
        this.body = requireText(props.body, 'body')
        this.sentAt = requireOptionalDate(props.sentAt, 'sentAt')
        this.sent = requireBoolean(props.sent, 'sent')

        if (this.sent && this.sentAt === null) {
            throw new Error('sentAt is required when sent is true.')
        }

        if (!this.sent && this.sentAt !== null) {
            throw new Error('sentAt must be null when sent is false.')
        }
    }
}
