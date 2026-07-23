import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { config as loadDotEnv } from 'dotenv'
import {
    afterAll,
    beforeAll,
    describe,
    expect,
    jest,
    test,
} from '@jest/globals'
import request from 'supertest'
import type { Express } from 'express'
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise'
import { createApiContainer } from '../../../src/app/api-container.js'
import { createApiApp } from '../../../src/app/create-api-app.js'
import { loadConfig } from '../../../src/config/environment.js'
import { Parent } from '../../../src/domain/entities/parent.js'
import { AccountType } from '../../../src/domain/value-objects/account-type.js'
import { EmailAddress } from '../../../src/domain/value-objects/email-address.js'
import { GetPreferencesModel } from '../../../src/modules/preferences/application/get-preferences.js'
import { SavePreferencesModel } from '../../../src/modules/preferences/application/save-preferences.js'
import { createMySqlPool } from '../../../src/infrastructure/mysql/pool.js'
import {
    discoverMigrationFiles,
    getMigrationLockName,
    runMigrations,
} from '../../../src/infrastructure/mysql/migration-runner.js'
import {
    MySqlNotificationPreferenceRepository,
    MySqlParentRepository,
} from '../../../src/infrastructure/mysql/repositories/index.js'

interface IntegrationDatabaseConfig {
    readonly host: string
    readonly port: number
    readonly database: string
    readonly user: string
    readonly password: string
}

const integrationEnvironmentFile = resolve(
    __dirname,
    '../../../.env.integration',
)
const migrationsDirectory = resolve(__dirname, '../../../db/migrations')

loadDotEnv({ path: integrationEnvironmentFile, quiet: true })

let pool: Pool | undefined
let migrationConnection: PoolConnection | undefined
let app: Express
let parentId: string
let userId: string

describe('Notification Preferences API end-to-end', () => {
    beforeAll(async () => {
        const config = readIntegrationDatabaseConfig()
        pool = createMySqlPool(config, {
            connectionLimit: 3,
            multipleStatements: true,
        })
        migrationConnection = await pool.getConnection()

        await runMigrations(migrationConnection, {
            migrationsDirectory,
            lockName: getMigrationLockName(config.database),
        })

        migrationConnection.release()
        migrationConnection = undefined

        parentId = `e2e-parent-${randomUUID()}`
        userId = `e2e-user-${randomUUID()}`

        const parentRepository = new MySqlParentRepository(pool)
        await parentRepository.save(
            new Parent({
                userId,
                parentId,
                name: 'E2E Parent',
                email: new EmailAddress(`${userId}@example.com`),
                mobileNumber: '+6512345678',
                passwordHash: 'integration-password-hash',
                accountType: new AccountType('parent'),
                isVerified: true,
            }),
        )

        const notificationPreferenceRepository =
            new MySqlNotificationPreferenceRepository(pool)
        const getPreferencesModel = new GetPreferencesModel({
            notificationPreferenceRepository,
        })
        const savePreferencesModel = new SavePreferencesModel({
            notificationPreferenceRepository,
        })

        app = createApiApp(
            createApiContainer(loadConfig({ NODE_ENV: 'test' }), {
                getPreferencesModel,
                savePreferencesModel,
            }),
        )
    })

    afterAll(async () => {
        migrationConnection?.release()

        if (!pool) {
            return
        }

        const cleanupConnection = await pool.getConnection()

        try {
            if (parentId) {
                await cleanupConnection.execute(
                    'DELETE FROM notification_preferences WHERE parent_id = ?',
                    [parentId],
                )
                await cleanupConnection.execute(
                    'DELETE FROM parents WHERE parent_id = ?',
                    [parentId],
                )
            }
            if (userId) {
                await cleanupConnection.execute(
                    'DELETE FROM users WHERE user_id = ?',
                    [userId],
                )
            }
        } finally {
            cleanupConnection.release()
        }

        await pool.end()
    })

    test('saves, normalizes, reads, and persists preferences', async () => {
        const putResponse = await request(app)
            .put(`/api/parents/${parentId}/preferences`)
            .send({
                enabled: false,
                frequency: 'Monthly',
                recipientEmail: ' Parent.Demo@Example.COM ',
            })

        expect(putResponse.status).toBe(200)
        expect(putResponse.body).toEqual({
            ok: true,
            data: {
                parentId,
                enabled: false,
                frequency: 'Monthly',
                recipientEmail: 'parent.demo@example.com',
            },
        })

        const getResponse = await request(app).get(
            `/api/parents/${parentId}/preferences`,
        )

        expect(getResponse.status).toBe(200)
        expect(getResponse.body).toEqual(putResponse.body)

        const [rows] = await pool!.query<PreferenceRow[]>(
            `
                SELECT parent_id, enabled, frequency, recipient_email
                FROM notification_preferences
                WHERE parent_id = ?
            `,
            [parentId],
        )

        expect(rows).toEqual([
            {
                parent_id: parentId,
                enabled: 0,
                frequency: 'Monthly',
                recipient_email: 'parent.demo@example.com',
            },
        ])
    })

    test('returns preferencesUnavailable when no preference exists', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined)
        const response = await request(app).get(
            `/api/parents/missing-${randomUUID()}/preferences`,
        )

        expect(response.status).toBe(404)
        expect(response.body).toEqual({
            ok: false,
            error: 'preferencesUnavailable',
        })
    })

    test('rejects invalid preference input before database persistence', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined)
        const response = await request(app)
            .put(`/api/parents/${parentId}/preferences`)
            .send({
                enabled: true,
                frequency: 'Daily',
                recipientEmail: 'not-an-email',
            })

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
            ok: false,
            error: 'Invalid request.',
        })
    })
})

function readIntegrationDatabaseConfig(): IntegrationDatabaseConfig {
    const requiredKeys = [
        'MYSQL_TEST_HOST',
        'MYSQL_TEST_PORT',
        'MYSQL_TEST_DATABASE',
        'MYSQL_TEST_USER',
        'MYSQL_TEST_PASSWORD',
    ] as const
    const missingKeys = requiredKeys.filter(
        (key) => process.env[key] === undefined,
    )

    if (missingKeys.length > 0) {
        throw new Error(
            `MySQL integration tests require ${missingKeys.join(
                ', ',
            )}. Copy .env.integration.example and export its values before running npm run test:integration.`,
        )
    }

    const database = process.env.MYSQL_TEST_DATABASE!.trim()

    if (!/(^|[_-])test([_-]|$)/i.test(database)) {
        throw new Error(
            'MYSQL_TEST_DATABASE must identify a dedicated test database (for example, das7_integration_test).',
        )
    }

    const port = Number(process.env.MYSQL_TEST_PORT)

    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error('MYSQL_TEST_PORT must be an integer between 1 and 65535.')
    }

    return {
        host: process.env.MYSQL_TEST_HOST!.trim(),
        port,
        database,
        user: process.env.MYSQL_TEST_USER!.trim(),
        password: process.env.MYSQL_TEST_PASSWORD!,
    }
}

interface PreferenceRow extends RowDataPacket {
    readonly parent_id: string
    readonly enabled: number
    readonly frequency: string
    readonly recipient_email: string
}
