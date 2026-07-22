import type { NotificationPreference } from '../../../domain/entities/notification-preference.js'

export interface NotificationPreferenceRepository {
    findByParentId(parentId: string): Promise<NotificationPreference | null>
    listEnabled(): Promise<readonly NotificationPreference[]>
    save(preference: NotificationPreference): Promise<void>
}
