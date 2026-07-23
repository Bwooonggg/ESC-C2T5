import { describe, expect, it } from '@jest/globals'
import { NotificationPreference } from '../../../src/domain/entities/notification-preference.js'
import { EmailAddress } from '../../../src/domain/value-objects/email-address.js'
import { NotificationFrequency } from '../../../src/domain/value-objects/notification-frequency.js'
import { GetPreferencesModel } from '../../../src/modules/preferences/application/get-preferences.js'
import { SavePreferencesModel } from '../../../src/modules/preferences/application/save-preferences.js'
import type { NotificationPreferenceRepository } from '../../../src/modules/preferences/ports/notification-preference.repository.js'

describe('notification preference application models', () => {
    it('returns the stored preference for a parent', async () => {
        const preference = makePreference()
        const repository = new FakeNotificationPreferenceRepository(preference)
        const model = new GetPreferencesModel({
            notificationPreferenceRepository: repository,
        })

        await expect(model.execute('parent-1')).resolves.toBe(preference)
        expect(repository.findByParentIdCalls).toEqual(['parent-1'])
    })

    it('returns null when a parent has no stored preference', async () => {
        const repository = new FakeNotificationPreferenceRepository(null)
        const model = new GetPreferencesModel({
            notificationPreferenceRepository: repository,
        })

        await expect(model.execute('parent-1')).resolves.toBeNull()
    })

    it('constructs, normalizes, and persists an updated preference', async () => {
        const repository = new FakeNotificationPreferenceRepository(null)
        const model = new SavePreferencesModel({
            notificationPreferenceRepository: repository,
        })

        const result = await model.execute('parent-1', {
            enabled: false,
            frequency: 'Monthly',
            recipientEmail: ' Parent.Demo@Example.COM ',
        })

        expect(result).toEqual(
            new NotificationPreference({
                parentId: 'parent-1',
                enabled: false,
                frequency: new NotificationFrequency('Monthly'),
                recipientEmail: new EmailAddress('parent.demo@example.com'),
            }),
        )
        expect(repository.saved).toEqual([result])
    })

    it('does not persist an invalid recipient email', async () => {
        const repository = new FakeNotificationPreferenceRepository(null)
        const model = new SavePreferencesModel({
            notificationPreferenceRepository: repository,
        })

        await expect(
            model.execute('parent-1', {
                enabled: true,
                frequency: 'Weekly',
                recipientEmail: 'not-an-email',
            }),
        ).rejects.toThrow('emailAddress must be a valid email address.')
        expect(repository.saved).toHaveLength(0)
    })
})

class FakeNotificationPreferenceRepository
    implements NotificationPreferenceRepository
{
    readonly saved: NotificationPreference[] = []
    readonly findByParentIdCalls: string[] = []

    constructor(private current: NotificationPreference | null) {}

    async findByParentId(
        parentId: string,
    ): Promise<NotificationPreference | null> {
        this.findByParentIdCalls.push(parentId)
        return this.current
    }

    async listEnabled(): Promise<readonly NotificationPreference[]> {
        return this.current?.enabled ? [this.current] : []
    }

    async save(preference: NotificationPreference): Promise<void> {
        this.saved.push(preference)
        this.current = preference
    }
}

function makePreference(): NotificationPreference {
    return new NotificationPreference({
        parentId: 'parent-1',
        enabled: true,
        frequency: new NotificationFrequency('Weekly'),
        recipientEmail: new EmailAddress('parent@example.com'),
    })
}
