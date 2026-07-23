import type { NotificationPreference } from '../../../domain/entities/notification-preference.js'
import type { NotificationFrequencyValue } from '../../../domain/value-objects/notification-frequency.js'

export interface NotificationPreferenceResponse {
    readonly parentId: string
    readonly enabled: boolean
    readonly frequency: NotificationFrequencyValue
    readonly recipientEmail: string
}

export function toNotificationPreferenceResponse(
    preference: NotificationPreference,
): NotificationPreferenceResponse {
    return {
        parentId: preference.parentId,
        enabled: preference.enabled,
        frequency: preference.frequency.value,
        recipientEmail: preference.recipientEmail.value,
    }
}
