import { describe, expect, it, jest } from '@jest/globals'
import type { Pool, RowDataPacket } from 'mysql2/promise'
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
import {
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
import type { MySqlExecutor } from '../../../src/infrastructure/mysql/repositories/mysql-repository.js'

const date = new Date('2026-07-23T12:00:00.000Z')

describe('MySQL repositories', () => {
    it('maps users and binds lookup/save values as parameters', async () => {
        const fake = createFakeExecutor([
            [row({
                user_id: 'u1',
                email: 'parent@example.com',
                mobile_number: '+6512345678',
                password_hash: 'hash',
                account_type: 'parent',
                is_verified: 1,
            })],
            [],
        ])
        const repository = new MySqlUserRepository(fake.executor)
        const user = await repository.findById("u1' OR '1'='1")

        expect(user?.userId).toBe('u1')
        expect(fake.execute.mock.calls[0]?.[1]).toEqual([
            "u1' OR '1'='1",
        ])

        await repository.save(
            new User({
                userId: 'u1',
                email: new EmailAddress('parent@example.com'),
                mobileNumber: '+6512345678',
                passwordHash: 'hash',
                accountType: new AccountType('parent'),
                isVerified: true,
            }),
        )

        expect(fake.execute.mock.calls[1]?.[0]).toContain(
            'INSERT INTO users',
        )
        expect(fake.execute.mock.calls[1]?.[1]).toEqual([
            'u1',
            'parent@example.com',
            '+6512345678',
            'hash',
            'parent',
            true,
        ])
    })

    it('loads guardian relationships and uses parameterized writes', async () => {
        const fake = createFakeExecutor([
            [row({
                parent_id: 'p1',
                name: 'A Parent',
                user_id: 'u1',
                email: 'parent@example.com',
                mobile_number: '+6512345678',
                password_hash: 'hash',
                account_type: 'parent',
                is_verified: 1,
            })],
            [row({
                student_id: 's1',
                name: 'A Student',
                date_of_birth: '2015-04-10',
                band_level: 'Band 3',
                current_progress_version: 'v1',
            })],
            [row({ guardian_exists: 1 })],
            [],
            [],
            [],
        ])
        const repository = new MySqlParentRepository(fake.executor)
        const parent = await repository.findById('p1')
        const students = await repository.listStudents('p1')
        const isGuardian = await repository.isGuardianOf('p1', 's1')

        expect(parent).toBeInstanceOf(Parent)
        expect(students[0]).toBeInstanceOf(Student)
        expect(isGuardian).toBe(true)

        await repository.save(createParent())
        await repository.assignStudent('p1', 's1')

        expect(fake.execute.mock.calls[3]?.[1]).toEqual([
            'u1',
            'parent@example.com',
            '+6512345678',
            'hash',
            'parent',
            true,
        ])
        expect(fake.execute.mock.calls[5]?.[1]).toEqual(['p1', 's1'])
    })

    it('uses one parameterized multi-row statement for progress writes', async () => {
        const fake = createFakeExecutor([[]])
        const repository = new MySqlProgressRecordRepository(fake.executor)
        const records = [
            createProgress('r1', 84.12),
            createProgress('r2', 85.25),
        ]

        await repository.saveMany(records)

        const [sql, values] = fake.execute.mock.calls[0] as [
            string,
            readonly unknown[],
        ]
        expect(sql).toContain('INSERT INTO progress_records')
        expect((sql.match(/\?/g) ?? []).length).toBe(12)
        expect(values).toEqual([
            'r1',
            's1',
            date,
            'Reading Fluency',
            84.12,
            'Fixture notes',
            'r2',
            's1',
            date,
            'Reading Fluency',
            85.25,
            'Fixture notes',
        ])
    })

    it('returns latest summaries and recommendation history through mappers', async () => {
        const fake = createFakeExecutor([
            [row({
                summary_id: 'sum2',
                student_id: 's1',
                content: 'Latest',
                generated_at: '2026-07-23 12:00:00.000',
                source_progress_version: 'v2',
            })],
            [row({
                summary_id: 'sum1',
                student_id: 's1',
                content: 'Earlier',
                generated_at: '2026-07-22 12:00:00.000',
                source_progress_version: 'v1',
            })],
            [row({
                recommendation_id: 'rec1',
                student_id: 's1',
                summary_id: 'sum2',
                content: 'Keep reading.',
                generated_at: '2026-07-23 12:01:00.000',
            })],
            [],
        ])
        const summaryRepository = new MySqlSummaryRepository(fake.executor)
        const recommendationRepository =
            new MySqlRecommendationRepository(fake.executor)

        expect(
            (await summaryRepository.findLatestByStudentId('s1'))?.summaryId,
        ).toBe('sum2')
        expect(
            (await summaryRepository.findHistoryByStudentId('s1'))[0]
                ?.summaryId,
        ).toBe('sum1')
        expect(
            (await recommendationRepository.findBySummaryId('sum2'))[0]
                ?.recommendationId,
        ).toBe('rec1')

        await summaryRepository.save(createSummary('sum3'))
        expect(fake.execute.mock.calls[3]?.[1]).toEqual([
            'sum3',
            's1',
            'Summary content',
            date,
            'v1',
        ])
    })

    it('maps notification preferences and binds email delivery fields', async () => {
        const fake = createFakeExecutor([
            [row({
                parent_id: 'p1',
                enabled: 1,
                frequency: 'Weekly',
                recipient_email: 'parent@example.com',
            })],
            [row({
                notification_id: 'n1',
                parent_id: 'p1',
                summary_id: 'sum1',
                recipient_email: 'parent@example.com',
                subject: 'Progress update',
                body: 'Summary body',
                sent_at: null,
                sent: 0,
            })],
            [],
            [],
        ])
        const preferenceRepository =
            new MySqlNotificationPreferenceRepository(fake.executor)
        const emailRepository = new MySqlEmailNotificationRepository(
            fake.executor,
        )

        expect(
            (await preferenceRepository.findByParentId('p1'))?.enabled,
        ).toBe(true)
        expect(
            (await emailRepository.findById('n1'))?.sent,
        ).toBe(false)

        await preferenceRepository.save(createPreference())
        await emailRepository.save(createEmailNotification())

        expect(fake.execute.mock.calls[2]?.[1]).toEqual([
            'p1',
            true,
            'Weekly',
            'parent@example.com',
        ])
    })

    it('updates notification job state with parameterized values', async () => {
        const fake = createFakeExecutor([[], []])
        const repository = new MySqlNotificationJobRepository(
            fake.executor as unknown as Pool,
        )

        await repository.markCompleted('job1', date)
        await repository.markFailed('job1', date, null, 'Provider failed')

        expect(fake.execute.mock.calls[0]?.[1]).toEqual([date, 'job1'])
        expect(fake.execute.mock.calls[1]?.[1]).toEqual([
            date,
            null,
            'Provider failed',
            'job1',
        ])
    })

    it('persists idempotency state and maps a stored response body', async () => {
        const fake = createFakeExecutor([
            [
                row({
                    scope: 'staff-1',
                    operation: 'add-progress',
                    idempotency_key: 'request-1',
                    request_hash: 'a'.repeat(64),
                    status: 'completed',
                    response_status: 201,
                    response_body: { ok: true, data: { accepted: true } },
                    expires_at: '2026-07-24 12:00:00.000',
                    completed_at: '2026-07-23 12:01:00.000',
                    failed_at: null,
                    created_at: '2026-07-23 12:00:00.000',
                }),
            ],
            [],
            [],
            [],
        ])
        const repository = new MySqlIdempotencyRepository(fake.executor)
        const key = {
            scope: 'staff-1',
            operation: 'add-progress',
            idempotencyKey: 'request-1',
        }

        const record = await repository.find(key)

        expect(record).toMatchObject({
            ...key,
            status: 'completed',
            responseStatus: 201,
            responseBody: { ok: true, data: { accepted: true } },
        })

        await repository.createProcessing({
            ...key,
            requestHash: 'a'.repeat(64),
            expiresAt: new Date('2026-07-24T12:00:00.000Z'),
        })
        await repository.markCompleted(
            key,
            201,
            { ok: true, data: { accepted: true } },
            date,
        )
        await repository.markFailed(key, 409, null, date)

        expect(fake.execute.mock.calls[1]?.[1]).toEqual([
            'staff-1',
            'add-progress',
            'request-1',
            'a'.repeat(64),
            new Date('2026-07-24T12:00:00.000Z'),
        ])
        expect(fake.execute.mock.calls[2]?.[1]).toEqual([
            201,
            JSON.stringify({ ok: true, data: { accepted: true } }),
            date,
            'staff-1',
            'add-progress',
            'request-1',
        ])
        expect(fake.execute.mock.calls[3]?.[1]).toEqual([
            409,
            null,
            date,
            'staff-1',
            'add-progress',
            'request-1',
        ])
    })
})

function createFakeExecutor(results: readonly unknown[]): {
    executor: MySqlExecutor
    execute: jest.Mock
} {
    const pendingResults = [...results]
    const execute = jest.fn(async () => [pendingResults.shift() ?? [], []])

    return {
        executor: { execute } as unknown as MySqlExecutor,
        execute,
    }
}

function row(values: Record<string, unknown>): RowDataPacket {
    return values as unknown as RowDataPacket
}

function createParent(): Parent {
    return new Parent({
        userId: 'u1',
        parentId: 'p1',
        name: 'A Parent',
        email: new EmailAddress('parent@example.com'),
        mobileNumber: '+6512345678',
        passwordHash: 'hash',
        accountType: new AccountType('parent'),
        isVerified: true,
    })
}

function createProgress(recordId: string, score: number): ProgressRecord {
    return new ProgressRecord({
        recordId,
        studentId: 's1',
        date,
        skillArea: new SkillArea('Reading Fluency'),
        score,
        notes: 'Fixture notes',
    })
}

function createSummary(summaryId: string): Summary {
    return new Summary({
        summaryId,
        studentId: 's1',
        content: 'Summary content',
        generatedAt: date,
        sourceProgressVersion: 'v1',
    })
}

function createPreference(): NotificationPreference {
    return new NotificationPreference({
        parentId: 'p1',
        enabled: true,
        frequency: new NotificationFrequency('Weekly'),
        recipientEmail: new EmailAddress('parent@example.com'),
    })
}

function createEmailNotification(): EmailNotification {
    return new EmailNotification({
        notificationId: 'n1',
        parentId: 'p1',
        summaryId: 'sum1',
        recipientEmail: new EmailAddress('parent@example.com'),
        subject: 'Progress update',
        body: 'Summary body',
        sentAt: null,
        sent: false,
    })
}
