import { describe, expect, it, jest } from '@jest/globals'
import request from 'supertest'
import { createApiContainer } from '../../src/app/api-container.js'
import { createApiApp } from '../../src/app/create-api-app.js'
import { loadConfig } from '../../src/config/environment.js'
import { NotificationPreference } from '../../src/domain/entities/notification-preference.js'
import { EmailAddress } from '../../src/domain/value-objects/email-address.js'
import { NotificationFrequency } from '../../src/domain/value-objects/notification-frequency.js'
import { GetPreferencesModel } from '../../src/modules/preferences/application/get-preferences.js'
import { SavePreferencesModel } from '../../src/modules/preferences/application/save-preferences.js'
import type { NotificationPreferenceRepository } from '../../src/modules/preferences/ports/notification-preference.repository.js'

describe('notification preference routes', () => {
    it('returns stored preferences in the frontend envelope', async () => {
        const repository = new FakeNotificationPreferenceRepository(
            makePreference(),
        )
        const app = createTestApp(repository)

        const response = await request(app).get(
            '/api/parents/parent-1/preferences',
        )

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
            ok: true,
            data: {
                parentId: 'parent-1',
                enabled: true,
                frequency: 'Weekly',
                recipientEmail: 'parent@example.com',
            },
        })
    })

    it('returns preferencesUnavailable when no row exists', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined)
        const app = createTestApp(
            new FakeNotificationPreferenceRepository(null),
        )

        const response = await request(app).get(
            '/api/parents/parent-1/preferences',
        )

        expect(response.status).toBe(404)
        expect(response.body).toEqual({
            ok: false,
            error: 'preferencesUnavailable',
        })
    })

    it('updates and returns normalized preference data', async () => {
        const repository = new FakeNotificationPreferenceRepository(null)
        const app = createTestApp(repository)

        const response = await request(app)
            .put('/api/parents/parent-1/preferences')
            .send({
                enabled: false,
                frequency: 'Monthly',
                recipientEmail: ' Parent.Demo@Example.COM ',
            })

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
            ok: true,
            data: {
                parentId: 'parent-1',
                enabled: false,
                frequency: 'Monthly',
                recipientEmail: 'parent.demo@example.com',
            },
        })
        expect(repository.saved[0]).toBeInstanceOf(NotificationPreference)
    })

    it('rejects invalid preference data before saving', async () => {
        const repository = new FakeNotificationPreferenceRepository(null)
        const app = createTestApp(repository)

        const response = await request(app)
            .put('/api/parents/parent-1/preferences')
            .send({
                enabled: 'yes',
                frequency: 'Daily',
                recipientEmail: 'not-an-email',
            })

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
            ok: false,
            error: 'Invalid request.',
        })
        expect(repository.saved).toHaveLength(0)
    })

    it('rejects an invalid parent ID before reading or saving', async () => {
        const repository = new FakeNotificationPreferenceRepository(
            makePreference(),
        )
        const app = createTestApp(repository)

        const response = await request(app).get(
            '/api/parents/%20/preferences',
        )

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
            ok: false,
            error: 'Invalid request.',
        })
        expect(repository.findByParentIdCalls).toHaveLength(0)
    })
})

function createTestApp(repository: NotificationPreferenceRepository) {
    return createApiApp(
        createApiContainer(loadConfig({ NODE_ENV: 'test' }), {
            getPreferencesModel: new GetPreferencesModel({
                notificationPreferenceRepository: repository,
            }),
            savePreferencesModel: new SavePreferencesModel({
                notificationPreferenceRepository: repository,
            }),
        }),
    )
}

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
