import { requireBoolean, requireText } from './entity-validation.js'
import { ValidationError } from '../errors/domain.error.js'
import { EmailAddress } from '../value-objects/email-address.js'
import { NotificationFrequency } from '../value-objects/notification-frequency.js'

export interface NotificationPreferenceProps {
    readonly parentId: string
    readonly enabled: boolean
    readonly frequency: NotificationFrequency
    readonly recipientEmail: EmailAddress
}

export class NotificationPreference {
    readonly parentId: string
    readonly enabled: boolean
    readonly frequency: NotificationFrequency
    readonly recipientEmail: EmailAddress

    constructor(props: NotificationPreferenceProps) {
        this.parentId = requireText(props.parentId, 'parentId')
        this.enabled = requireBoolean(props.enabled, 'enabled')

        if (!(props.frequency instanceof NotificationFrequency)) {
            throw new ValidationError(
                'frequency must be a NotificationFrequency.',
            )
        }

        if (!(props.recipientEmail instanceof EmailAddress)) {
            throw new ValidationError('recipientEmail must be an EmailAddress.')
        }

        this.frequency = props.frequency
        this.recipientEmail = props.recipientEmail
    }
}
