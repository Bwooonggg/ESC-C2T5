import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { config as loadDotEnv } from 'dotenv'
import {
    afterAll,
    beforeAll,
    describe,
    expect,
    test,
} from '@jest/globals'
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise'
import { EmailNotification } from '../../../src/domain/entities/email-notification.js'
import { NotificationPreference } from '../../../src/domain/entities/notification-preference.js'
import { Parent } from '../../../src/domain/entities/parent.js'
import { ProgressRecord } from '../../../src/domain/entities/progress-record.js'
import { Recommendation } from '../../../src/domain/entities/recommendation.js'
import { Student } from '../../../src/domain/entities/student.js'
import { Summary } from '../../../src/domain/entities/summary.js'
import { User } from '../../../src/domain/entities/user.js'
import { AccountType } from '../../../src/domain/value-objects/account-type.js'
import { EmailAddress } from '../../../src/domain/value-objects/email-address.js'
import { NotificationFrequency } from '../../../src/domain/value-objects/notification-frequency.js'
import { SkillArea } from '../../../src/domain/value-objects/skill-area.js'
import { createMySqlPool } from '../../../src/infrastructure/mysql/pool.js'
import {
    discoverMigrationFiles,
    getMigrationLockName,
    migrationTableName,
    runMigrations,
} from '../../../src/infrastructure/mysql/migration-runner.js'
import {
    MySqlAuditRepository,
    MySqlEmailNotificationRepository,
    MySqlIdempotencyRepository,
    MySqlNotificationJobRepository,
    MySqlNotificationPreferenceRepository,
    MySqlParentRepository,
    MySqlProgressRecordRepository,
    MySqlRecommendationRepository,
    MySqlStudentRepository,
    MySqlSummaryRepository,
    MySqlUserRepository,
} from '../../../src/infrastructure/mysql/repositories/index.js'
import { withMySqlTransaction } from '../../../src/infrastructure/mysql/transaction-manager.js'

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
            connectionLimit: 2,
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

    test('persists and retrieves repository records against the migrated schema', async () => {
        const ids = {
            user: `repository-user-${randomUUID()}`,
            parent: `repository-parent-${randomUUID()}`,
            student: `repository-student-${randomUUID()}`,
            record: `repository-record-${randomUUID()}`,
            summary: `repository-summary-${randomUUID()}`,
            recommendation: `repository-recommendation-${randomUUID()}`,
            notification: `repository-notification-${randomUUID()}`,
            job: `repository-job-${randomUUID()}`,
            audit: `repository-audit-${randomUUID()}`,
            idempotency: `repository-idempotency-${randomUUID()}`,
            failedIdempotency: `repository-failed-idempotency-${randomUUID()}`,
        }
        const now = new Date('2026-07-23T12:00:00.000Z')
        const userRepository = new MySqlUserRepository(connection!)
        const parentRepository = new MySqlParentRepository(connection!)
        const studentRepository = new MySqlStudentRepository(connection!)
        const progressRepository = new MySqlProgressRecordRepository(
            connection!,
        )
        const summaryRepository = new MySqlSummaryRepository(connection!)
        const recommendationRepository =
            new MySqlRecommendationRepository(connection!)
        const preferenceRepository =
            new MySqlNotificationPreferenceRepository(connection!)
        const emailRepository = new MySqlEmailNotificationRepository(
            connection!,
        )
        const auditRepository = new MySqlAuditRepository(connection!)
        const idempotencyRepository = new MySqlIdempotencyRepository(
            connection!,
        )
        const jobRepository = new MySqlNotificationJobRepository(pool!)
        const idempotencyKey = {
            scope: ids.parent,
            operation: 'repository.integration',
            idempotencyKey: ids.idempotency,
        }
        const failedIdempotencyKey = {
            ...idempotencyKey,
            idempotencyKey: ids.failedIdempotency,
        }

        try {
            const parent = new Parent({
                userId: ids.user,
                parentId: ids.parent,
                name: 'Repository Parent',
                email: new EmailAddress(`${ids.user}@example.test`),
                mobileNumber: '+6590000000',
                passwordHash: 'deferred-auth-placeholder',
                accountType: new AccountType('parent'),
                isVerified: true,
            })
            const student = new Student({
                studentId: ids.student,
                name: 'Repository Student',
                dateOfBirth: new Date('2015-06-15T00:00:00.000Z'),
                bandLevel: 'Band 2',
                currentProgressVersion: 'v1',
            })

            await userRepository.save(parent)
            await parentRepository.save(parent)
            await studentRepository.save(student)
            await parentRepository.assignStudent(ids.parent, ids.student)
            await progressRepository.save(
                new ProgressRecord({
                    recordId: ids.record,
                    studentId: ids.student,
                    date: new Date('2026-07-23T00:00:00.000Z'),
                    skillArea: new SkillArea('Reading Fluency'),
                    score: 98.75,
                    notes: 'Repository integration fixture',
                }),
            )
            await summaryRepository.save(
                new Summary({
                    summaryId: ids.summary,
                    studentId: ids.student,
                    content: 'Repository integration summary',
                    generatedAt: now,
                    sourceProgressVersion: 'v1',
                }),
            )
            await recommendationRepository.save(
                new Recommendation({
                    recommendationId: ids.recommendation,
                    studentId: ids.student,
                    summaryId: ids.summary,
                    content: 'Repository integration recommendation',
                    generatedAt: now,
                }),
            )
            await preferenceRepository.save(
                new NotificationPreference({
                    parentId: ids.parent,
                    enabled: true,
                    frequency: new NotificationFrequency('Weekly'),
                    recipientEmail: new EmailAddress(
                        `${ids.user}@example.test`,
                    ),
                }),
            )
            await emailRepository.save(
                new EmailNotification({
                    notificationId: ids.notification,
                    parentId: ids.parent,
                    summaryId: ids.summary,
                    recipientEmail: new EmailAddress(
                        `${ids.user}@example.test`,
                    ),
                    subject: 'Repository integration',
                    body: 'Repository integration body',
                    sentAt: null,
                    sent: false,
                }),
            )
            await jobRepository.save({
                jobId: ids.job,
                parentId: ids.parent,
                studentId: ids.student,
                summaryId: ids.summary,
                emailNotificationId: ids.notification,
                scheduledFor: new Date('2026-07-23T11:00:00.000Z'),
                status: 'pending',
                attempts: 0,
                leaseExpiresAt: null,
                completedAt: null,
                failedAt: null,
                retryAt: null,
                lastError: null,
            })
            await auditRepository.record({
                eventId: ids.audit,
                actorUserId: ids.user,
                action: 'repository.integration',
                entityType: 'Student',
                entityId: ids.student,
                occurredAt: now,
                metadata: { source: 'jest' },
            })
            await idempotencyRepository.createProcessing({
                ...idempotencyKey,
                requestHash: 'a'.repeat(64),
                expiresAt: new Date('2099-01-01T00:00:00.000Z'),
            })
            expect(await idempotencyRepository.find(idempotencyKey)).toMatchObject(
                {
                    ...idempotencyKey,
                    status: 'processing',
                },
            )
            await idempotencyRepository.markCompleted(
                idempotencyKey,
                201,
                { ok: true, data: { accepted: true } },
                now,
            )
            expect(
                await idempotencyRepository.find(idempotencyKey),
            ).toMatchObject({
                status: 'completed',
                responseStatus: 201,
                responseBody: { ok: true, data: { accepted: true } },
            })
            await expect(
                idempotencyRepository.createProcessing({
                    ...idempotencyKey,
                    requestHash: 'b'.repeat(64),
                    expiresAt: new Date('2099-01-01T00:00:00.000Z'),
                }),
            ).rejects.toThrow()
            await idempotencyRepository.markCompleted(
                idempotencyKey,
                202,
                { ok: true, data: { shouldNotReplace: true } },
                new Date('2026-07-23T12:02:00.000Z'),
            )
            expect(
                (await idempotencyRepository.find(idempotencyKey))
                    ?.responseStatus,
            ).toBe(201)
            await idempotencyRepository.createProcessing({
                ...failedIdempotencyKey,
                requestHash: 'c'.repeat(64),
                expiresAt: new Date('2099-01-01T00:00:00.000Z'),
            })
            await idempotencyRepository.markFailed(
                failedIdempotencyKey,
                422,
                { ok: false, error: 'invalid progress' },
                now,
            )
            expect(
                await idempotencyRepository.find(failedIdempotencyKey),
            ).toMatchObject({
                status: 'failed',
                responseStatus: 422,
                responseBody: { ok: false, error: 'invalid progress' },
            })

            expect((await userRepository.findById(ids.user))?.userId).toBe(
                ids.user,
            )
            expect(
                (await userRepository.findByEmail(parent.email))?.userId,
            ).toBe(ids.user)
            expect(
                (await parentRepository.findByUserId(ids.user))?.parentId,
            ).toBe(ids.parent)
            expect((await studentRepository.findById(ids.student))?.studentId).toBe(
                ids.student,
            )
            expect(
                (await parentRepository.listStudents(ids.parent))[0]
                    ?.studentId,
            ).toBe(ids.student)
            expect(
                (await progressRepository.findByStudentId(ids.student))[0]
                    ?.score,
            ).toBe(98.75)
            expect(
                (await summaryRepository.findLatestByStudentId(ids.student))
                    ?.summaryId,
            ).toBe(ids.summary)
            expect(
                (await recommendationRepository.findBySummaryId(ids.summary))
                    .length,
            ).toBe(1)
            expect(
                (await recommendationRepository.findByStudentId(ids.student))
                    .length,
            ).toBe(1)
            expect(
                (await preferenceRepository.findByParentId(ids.parent))
                    ?.frequency.value,
            ).toBe('Weekly')
            expect(
                (await preferenceRepository.listEnabled()).some(
                    (preference) => preference.parentId === ids.parent,
                ),
            ).toBe(true)
            expect(
                (await emailRepository.findPending(10))[0]?.notificationId,
            ).toBe(ids.notification)
            expect(
                (await emailRepository.findById(ids.notification))?.sent,
            ).toBe(false)

            const claimed = await jobRepository.claimDue(
                now,
                new Date('2026-07-23T12:30:00.000Z'),
                10,
            )
            expect(claimed[0]).toMatchObject({
                jobId: ids.job,
                status: 'processing',
                attempts: 1,
            })

            await jobRepository.markCompleted(ids.job, now)
        } finally {
            await connection!.execute(
                'DELETE FROM notification_jobs WHERE job_id = ?',
                [ids.job],
            )
            await connection!.execute(
                'DELETE FROM email_notifications WHERE notification_id = ?',
                [ids.notification],
            )
            await connection!.execute(
                'DELETE FROM recommendations WHERE recommendation_id = ?',
                [ids.recommendation],
            )
            await connection!.execute(
                'DELETE FROM summaries WHERE summary_id = ?',
                [ids.summary],
            )
            await connection!.execute(
                'DELETE FROM progress_records WHERE record_id = ?',
                [ids.record],
            )
            await connection!.execute(
                'DELETE FROM notification_preferences WHERE parent_id = ?',
                [ids.parent],
            )
            await connection!.execute(
                'DELETE FROM audit_events WHERE event_id = ?',
                [ids.audit],
            )
            await connection!.execute(
                'DELETE FROM idempotency_records WHERE scope = ? AND operation = ? AND idempotency_key IN (?, ?)',
                [
                    idempotencyKey.scope,
                    idempotencyKey.operation,
                    idempotencyKey.idempotencyKey,
                    failedIdempotencyKey.idempotencyKey,
                ],
            )
            await connection!.execute(
                'DELETE FROM parent_students WHERE parent_id = ? AND student_id = ?',
                [ids.parent, ids.student],
            )
            await connection!.execute(
                'DELETE FROM parents WHERE parent_id = ?',
                [ids.parent],
            )
            await connection!.execute(
                'DELETE FROM users WHERE user_id = ?',
                [ids.user],
            )
        }
    })

    test('rolls back related repository writes as one transaction', async () => {
        const ids = {
            user: `rollback-user-${randomUUID()}`,
            student: `rollback-student-${randomUUID()}`,
        }
        const user = new User({
            userId: ids.user,
            email: new EmailAddress(`${ids.user}@example.test`),
            mobileNumber: '+6590000000',
            passwordHash: 'deferred-auth-placeholder',
            accountType: new AccountType('parent'),
            isVerified: true,
        })
        const student = new Student({
            studentId: ids.student,
            name: 'Rollback Student',
            dateOfBirth: new Date('2015-06-15T00:00:00.000Z'),
            bandLevel: 'Band 2',
            currentProgressVersion: 'v0',
        })

        await expect(
            withMySqlTransaction(pool!, async (transaction) => {
                await new MySqlUserRepository(transaction).save(user)
                await new MySqlStudentRepository(transaction).save(student)
                throw new Error('intentional transaction failure')
            }),
        ).rejects.toThrow('intentional transaction failure')

        expect(await new MySqlUserRepository(connection!).findById(ids.user)).toBe(
            null,
        )
        expect(
            await new MySqlStudentRepository(connection!).findById(ids.student),
        ).toBe(null)
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
