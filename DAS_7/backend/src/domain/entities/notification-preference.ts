import {
    requireBoolean,
    requireText,
} from './entity-validation.js'

export interface NotificationPreferenceProps {
    readonly parentId: string
    readonly enabled: boolean
    readonly frequency: string
    readonly recipientEmail: string
}

export class NotificationPreference {
    readonly parentId: string
    readonly enabled: boolean
    readonly frequency: string
    readonly recipientEmail: string

    constructor(props: NotificationPreferenceProps) {
        this.parentId = requireText(props.parentId, 'parentId')
        this.enabled = requireBoolean(props.enabled, 'enabled')
        this.frequency = requireText(props.frequency, 'frequency')
        this.recipientEmail = requireText(
            props.recipientEmail,
            'recipientEmail',
        )
    }
}
