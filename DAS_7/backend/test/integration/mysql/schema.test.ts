import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { config as loadDotEnv } from 'dotenv'
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise'
import { createMySqlPool } from '../../../src/infrastructure/mysql/pool.js'
import {
    discoverMigrationFiles,
    getMigrationLockName,
    migrationTableName,
    runMigrations,
} from '../../../src/infrastructure/mysql/migration-runner.js'

interface IntegrationDatabaseConfig {
    readonly host: string
    readonly port: number
    readonly database: string
    readonly user: string
    readonly password: string
}

interface TableRow extends RowDataPacket {
    readonly tableName: string
    readonly engine: string
}

interface IndexRow extends RowDataPacket {
    readonly indexName: string
}

const migrationsDirectory = resolve(__dirname, '../../../db/migrations')
const integrationEnvironmentFile = resolve(
    __dirname,
    '../../../.env.integration',
)

loadDotEnv({ path: integrationEnvironmentFile, quiet: true })

const expectedTables = [
    'audit_events',
    'email_notifications',
    'idempotency_records',
    'notification_jobs',
    'notification_preferences',
    'parent_students',
    'parents',
    'progress_records',
    'recommendations',
    'schema_migrations',
    'students',
    'summaries',
    'users',
]

const expectedIndexes = [
    'idx_audit_events_actor',
    'idx_audit_events_entity',
    'idx_email_notifications_pending',
    'idx_idempotency_records_expiry',
    'idx_notification_jobs_lease',
    'idx_notification_jobs_pending_schedule',
    'idx_notification_jobs_retry',
    'idx_notification_preferences_enabled_frequency',
    'idx_parent_students_student',
    'idx_progress_records_student_date',
    'idx_recommendations_student_generated',
    'idx_summaries_student_generated',
]

let pool: Pool | undefined
let connection: PoolConnection | undefined

describe('MySQL schema integration', () => {
    beforeAll(async () => {
        const config = readIntegrationDatabaseConfig()

        pool = createMySqlPool(config, {
            connectionLimit: 1,
            multipleStatements: true,
        })
        connection = await pool.getConnection()

        const migrations = await discoverMigrationFiles(migrationsDirectory)
        const result = await runMigrations(connection, {
            migrationsDirectory,
            lockName: getMigrationLockName(config.database),
        })

        expect(result.applied.length + result.skipped.length).toBe(
            migrations.length,
        )
    })

    afterAll(async () => {
        connection?.release()
        await pool?.end()
    })

    test('records every migration and is safe to run again', async () => {
        const migrations = await discoverMigrationFiles(migrationsDirectory)
        const config = readIntegrationDatabaseConfig()

        const [rows] = await connection!.query<RowDataPacket[]>(
            `
                SELECT migration_id AS migrationId, checksum
                FROM ${migrationTableName}
                ORDER BY migration_id
            `,
        )
        const migrationRows = rows as Array<{
            migrationId: string
            checksum: string
        }>

        expect(migrationRows.map((row) => row.migrationId)).toEqual(
            migrations.map((migration) => migration.id),
        )
        expect(migrationRows.every((row) => /^[a-f0-9]{64}$/i.test(row.checksum))).toBe(
            true,
        )

        const rerun = await runMigrations(connection!, {
            migrationsDirectory,
            lockName: getMigrationLockName(config.database),
        })

        expect(rerun.applied).toEqual([])
        expect(rerun.skipped).toEqual(migrations.map((migration) => migration.id))
    })

    test('creates the expected InnoDB tables and query indexes', async () => {
        const [tableRows] = await connection!.query<TableRow[]>(
            `
                SELECT TABLE_NAME AS tableName, ENGINE AS engine
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                ORDER BY TABLE_NAME
            `,
        )

        expect(tableRows.map((row) => row.tableName)).toEqual(expectedTables)
        expect(tableRows.every((row) => row.engine === 'InnoDB')).toBe(true)

        const [indexRows] = await connection!.query<IndexRow[]>(
            `
                SELECT DISTINCT INDEX_NAME AS indexName
                FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                    AND INDEX_NAME LIKE 'idx_%'
                ORDER BY INDEX_NAME
            `,
        )

        expect(indexRows.map((row) => row.indexName)).toEqual(expectedIndexes)
    })

    test('enforces guardian, summary, recommendation, and score relationships', async () => {
        const ids = {
            user: `integration-user-${randomUUID()}`,
            parent: `integration-parent-${randomUUID()}`,
            student: `integration-student-${randomUUID()}`,
            record: `integration-record-${randomUUID()}`,
            summary: `integration-summary-${randomUUID()}`,
            recommendation: `integration-recommendation-${randomUUID()}`,
            notification: `integration-notification-${randomUUID()}`,
            job: `integration-job-${randomUUID()}`,
        }

        await connection!.beginTransaction()

        try {
            await connection!.execute(
                `
                    INSERT INTO users
                        (user_id, email, mobile_number, password_hash, account_type)
                    VALUES (?, ?, ?, ?, ?)
                `,
                [
                    ids.user,
                    `${ids.user}@example.test`,
                    '+6590000000',
                    'deferred-auth-placeholder',
                    'parent',
                ],
            )
            await connection!.execute(
                `
                    INSERT INTO parents (parent_id, user_id, name)
                    VALUES (?, ?, ?)
                `,
                [ids.parent, ids.user, 'Integration Parent'],
            )
            await connection!.execute(
                `
                    INSERT INTO students (student_id, name, date_of_birth, band_level)
                    VALUES (?, ?, ?, ?)
                `,
                [ids.student, 'Integration Student', '2015-06-15', 'Band 2'],
            )
            await connection!.execute(
                `
                    INSERT INTO parent_students (parent_id, student_id)
                    VALUES (?, ?)
                `,
                [ids.parent, ids.student],
            )
            await connection!.execute(
                `
                    INSERT INTO progress_records
                        (record_id, student_id, assessment_date, skill_area, score, notes)
                    VALUES (?, ?, ?, ?, ?, ?)
                `,
                [
                    ids.record,
                    ids.student,
                    '2026-07-23',
                    'Reading Fluency',
                    98.75,
                    'Integration fixture',
                ],
            )
            await connection!.execute(
                `
                    INSERT INTO summaries
                        (summary_id, student_id, content, generated_at, source_progress_version)
                    VALUES (?, ?, ?, ?, ?)
                `,
                [
                    ids.summary,
                    ids.student,
                    'Integration summary',
                    '2026-07-23 12:00:00.000',
                    'v1',
                ],
            )
            await connection!.execute(
                `
                    INSERT INTO recommendations
                        (recommendation_id, student_id, summary_id, content, generated_at)
                    VALUES (?, ?, ?, ?, ?)
                `,
                [
                    ids.recommendation,
                    ids.student,
                    ids.summary,
                    'Integration recommendation',
                    '2026-07-23 12:00:00.000',
                ],
            )
            await connection!.execute(
                `
                    INSERT INTO notification_preferences
                        (parent_id, enabled, frequency, recipient_email)
                    VALUES (?, ?, ?, ?)
                `,
                [ids.parent, true, 'Weekly', `${ids.user}@example.test`],
            )
            await connection!.execute(
                `
                    INSERT INTO email_notifications
                        (notification_id, parent_id, summary_id, recipient_email, subject, body)
                    VALUES (?, ?, ?, ?, ?, ?)
                `,
                [
                    ids.notification,
                    ids.parent,
                    ids.summary,
                    `${ids.user}@example.test`,
                    'Integration subject',
                    'Integration body',
                ],
            )
            await connection!.execute(
                `
                    INSERT INTO notification_jobs
                        (job_id, parent_id, student_id, scheduled_for)
                    VALUES (?, ?, ?, ?)
                `,
                [ids.job, ids.parent, ids.student, '2026-07-24 12:00:00.000'],
            )

            const [progressRows] = await connection!.execute<RowDataPacket[]>(
                `
                    SELECT score
                    FROM progress_records
                    WHERE record_id = ?
                `,
                [ids.record],
            )
            expect((progressRows as Array<{ score: string }>)[0]?.score).toBe(
                '98.75',
            )

            await expect(
                connection!.execute(
                    `
                        INSERT INTO progress_records
                            (record_id, student_id, assessment_date, skill_area, score, notes)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `,
                    [
                        `invalid-record-${randomUUID()}`,
                        ids.student,
                        '2026-07-23',
                        'Not A Skill Area',
                        50.0,
                        'Should fail',
                    ],
                ),
            ).rejects.toThrow()

            await expect(
                connection!.execute(
                    `
                        INSERT INTO progress_records
                            (record_id, student_id, assessment_date, skill_area, score, notes)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `,
                    [
                        `invalid-score-${randomUUID()}`,
                        ids.student,
                        '2026-07-23',
                        'Reading Fluency',
                        100.01,
                        'Should fail',
                    ],
                ),
            ).rejects.toThrow()

            await expect(
                connection!.execute(
                    `
                        INSERT INTO parent_students (parent_id, student_id)
                        VALUES (?, ?)
                    `,
                    [`missing-parent-${randomUUID()}`, ids.student],
                ),
            ).rejects.toThrow()
        } finally {
            await connection!.rollback()
        }
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
