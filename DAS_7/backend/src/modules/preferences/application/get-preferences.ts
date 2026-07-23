import type { NotificationPreference } from '../../../domain/entities/notification-preference.js'
import type { NotificationPreferenceRepository } from '../ports/notification-preference.repository.js'

export interface GetPreferencesModelDependencies {
    readonly notificationPreferenceRepository: NotificationPreferenceRepository
}

export class GetPreferencesModel {
    private readonly notificationPreferenceRepository: NotificationPreferenceRepository

    constructor(dependencies: GetPreferencesModelDependencies) {
        this.notificationPreferenceRepository =
            dependencies.notificationPreferenceRepository
    }

    execute(parentId: string): Promise<NotificationPreference | null> {
        return this.notificationPreferenceRepository.findByParentId(parentId)
    }
}
