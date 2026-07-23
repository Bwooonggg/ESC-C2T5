import { NotificationPreference } from '../../../domain/entities/notification-preference.js'
import { EmailAddress } from '../../../domain/value-objects/email-address.js'
import {
    NotificationFrequency,
    type NotificationFrequencyValue,
} from '../../../domain/value-objects/notification-frequency.js'
import type { NotificationPreferenceRepository } from '../ports/notification-preference.repository.js'

export interface SavePreferencesInput {
    readonly enabled: boolean
    readonly frequency: NotificationFrequencyValue
    readonly recipientEmail: string
}

export interface SavePreferencesModelDependencies {
    readonly notificationPreferenceRepository: NotificationPreferenceRepository
}

export class SavePreferencesModel {
    private readonly notificationPreferenceRepository: NotificationPreferenceRepository

    constructor(dependencies: SavePreferencesModelDependencies) {
        this.notificationPreferenceRepository =
            dependencies.notificationPreferenceRepository
    }

    async execute(
        parentId: string,
        input: SavePreferencesInput,
    ): Promise<NotificationPreference> {
        const preference = new NotificationPreference({
            parentId,
            enabled: input.enabled,
            frequency: new NotificationFrequency(input.frequency),
            recipientEmail: new EmailAddress(input.recipientEmail),
        })

        await this.notificationPreferenceRepository.save(preference)

        return preference
    }
}
