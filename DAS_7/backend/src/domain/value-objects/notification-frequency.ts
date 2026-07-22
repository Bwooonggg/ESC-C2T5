import { requireKnownValue } from './value-object-validation.js'

export const NOTIFICATION_FREQUENCY_VALUES = [
    'Weekly',
    'Fortnightly',
    'Monthly',
] as const

export type NotificationFrequencyValue =
    (typeof NOTIFICATION_FREQUENCY_VALUES)[number]

export class NotificationFrequency {
    readonly value: NotificationFrequencyValue

    constructor(value: unknown) {
        this.value = requireKnownValue(
            value,
            'notificationFrequency',
            NOTIFICATION_FREQUENCY_VALUES,
        )

        Object.freeze(this)
    }

    equals(other: NotificationFrequency): boolean {
        return this.value === other.value
    }

    toString(): string {
        return this.value
    }
}
