import {
    requireBoolean,
    requireOptionalDate,
    requireText,
} from './entity-validation.js'
import { ValidationError } from '../errors/domain.error.js'
import { EmailAddress } from '../value-objects/email-address.js'

export interface EmailNotificationProps {
    readonly notificationId: string
    readonly parentId: string
    /**
     * Persistence ownership projection used to enforce the guardian and
     * summary relationships in the Supabase schema.
     */
    readonly studentId: string
    readonly summaryId: string
    readonly recipientEmail: EmailAddress
    readonly subject: string
    readonly body: string
    readonly sentAt: Date | null
    readonly sent: boolean
}

export class EmailNotification {
    readonly notificationId: string
    readonly parentId: string
    readonly studentId: string
    readonly summaryId: string
    readonly recipientEmail: EmailAddress
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
        this.studentId = requireText(props.studentId, 'studentId')
        this.summaryId = requireText(props.summaryId, 'summaryId')

        if (!(props.recipientEmail instanceof EmailAddress)) {
            throw new ValidationError('recipientEmail must be an EmailAddress.')
        }

        this.recipientEmail = props.recipientEmail
        this.subject = requireText(props.subject, 'subject')
        this.body = requireText(props.body, 'body')
        this.sentAt = requireOptionalDate(props.sentAt, 'sentAt')
        this.sent = requireBoolean(props.sent, 'sent')

        if (this.sent && this.sentAt === null) {
            throw new ValidationError('sentAt is required when sent is true.')
        }

        if (!this.sent && this.sentAt !== null) {
            throw new ValidationError('sentAt must be null when sent is false.')
        }
    }
}
