import { describe, expect, it } from '@jest/globals'
import {
    mapAuditEventToInsert,
    mapEmailNotificationToInsert,
    mapIdempotencyInputToInsert,
    mapIdempotencyTerminalToUpdate,
    mapNotificationJobToInsert,
    mapParentStudentToInsert,
    mapParentToInsert,
    mapPreferenceToInsert,
    mapRecommendationToInsert,
    mapStudentToInsert,
    mapSummaryToInsert,
} from '../../../src/infrastructure/supabase/mappers/domain-write-mappers.js'
import { EmailNotification } from '../../../src/domain/entities/email-notification.js'
import { NotificationPreference } from '../../../src/domain/entities/notification-preference.js'
import { Parent } from '../../../src/domain/entities/parent.js'
import { Recommendation } from '../../../src/domain/entities/recommendation.js'
import { Student } from '../../../src/domain/entities/student.js'
import { Summary } from '../../../src/domain/entities/summary.js'
import { EmailAddress } from '../../../src/domain/value-objects/email-address.js'
import { NotificationFrequency } from '../../../src/domain/value-objects/notification-frequency.js'
import type { AuditEvent } from '../../../src/modules/ingestion/ports/audit.repository.js'
import type { IdempotencyRecordInput } from '../../../src/modules/ingestion/ports/idempotency.repository.js'
import type { NotificationJob } from '../../../src/modules/notifications/ports/notification-job.repository.js'

describe('mapParentToInsert', () => {
    it('maps a Parent entity into a parent_profiles insert', () => {
        const parent = new Parent({
            parentId: 'p1',
            authUserId: 'auth-1',
            name: 'A Parent',
        })

        expect(mapParentToInsert(parent)).toEqual({
            parent_id: 'p1',
            auth_user_id: 'auth-1',
            name: 'A Parent',
        })
    })
})

describe('mapParentStudentToInsert', () => {
    it('maps the guardianship pair into a join-table insert', () => {
        expect(mapParentStudentToInsert('p1', 's1')).toEqual({
            parent_id: 'p1',
            student_id: 's1',
        })
    })
})

describe('mapStudentToInsert', () => {
    it('maps a Student entity, normalising the progress version to a number', () => {
        const student = new Student({
            studentId: 's1',
            name: 'A Student',
            dateOfBirth: new Date('2015-04-10T00:00:00.000Z'),
            bandLevel: 'Band 3',
            currentProgressVersion: 'v2',
        })

        expect(mapStudentToInsert(student)).toEqual({
            student_id: 's1',
            name: 'A Student',
            date_of_birth: '2015-04-10',
            band_level: 'Band 3',
            current_progress_version: 2,
        })
    })
})

describe('mapSummaryToInsert', () => {
    it('maps a Summary entity into a summaries insert', () => {
        const summary = new Summary({
            summaryId: 'sum1',
            studentId: 's1',
            content: 'A generated summary.',
            generatedAt: new Date('2026-07-25T09:30:00.000Z'),
            sourceProgressVersion: 'v3',
        })

        expect(mapSummaryToInsert(summary)).toEqual({
            summary_id: 'sum1',
            student_id: 's1',
            content: 'A generated summary.',
            generated_at: '2026-07-25T09:30:00.000Z',
            source_progress_version: 3,
            generation_metadata: {},
        })
    })
})

describe('mapRecommendationToInsert', () => {
    it('maps a Recommendation entity into a recommendations insert', () => {
        const recommendation = new Recommendation({
            recommendationId: 'rec1',
            studentId: 's1',
            summaryId: 'sum1',
            content: 'Practice reading aloud.',
            generatedAt: new Date('2026-07-25T09:30:00.000Z'),
        })

        expect(mapRecommendationToInsert(recommendation)).toEqual({
            recommendation_id: 'rec1',
            student_id: 's1',
            summary_id: 'sum1',
            content: 'Practice reading aloud.',
            generated_at: '2026-07-25T09:30:00.000Z',
            generation_metadata: {},
        })
    })
})

describe('mapPreferenceToInsert', () => {
    it('maps a NotificationPreference entity into a preferences insert', () => {
        const preference = new NotificationPreference({
            parentId: 'p1',
            enabled: true,
            frequency: new NotificationFrequency('Weekly'),
            recipientEmail: new EmailAddress('parent@example.com'),
        })

        expect(mapPreferenceToInsert(preference)).toEqual({
            parent_id: 'p1',
            enabled: true,
            frequency: 'Weekly',
            recipient_email: 'parent@example.com',
        })
    })
})

describe('mapEmailNotificationToInsert', () => {
    it('maps a sent notification, serialising the sentAt timestamp', () => {
        const notification = new EmailNotification({
            notificationId: 'n1',
            parentId: 'p1',
            studentId: 's1',
            summaryId: 'sum1',
            recipientEmail: new EmailAddress('parent@example.com'),
            subject: 'Weekly update',
            body: 'Here is the update.',
            sentAt: new Date('2026-07-25T09:30:00.000Z'),
            sent: true,
        })

        expect(mapEmailNotificationToInsert(notification)).toEqual({
            notification_id: 'n1',
            parent_id: 'p1',
            student_id: 's1',
            summary_id: 'sum1',
            recipient_email: 'parent@example.com',
            subject: 'Weekly update',
            body: 'Here is the update.',
            sent_at: '2026-07-25T09:30:00.000Z',
            sent: true,
            provider_message_id: null,
        })
    })

    it('maps an unsent notification with a null sent_at', () => {
        const notification = new EmailNotification({
            notificationId: 'n1',
            parentId: 'p1',
            studentId: 's1',
            summaryId: 'sum1',
            recipientEmail: new EmailAddress('parent@example.com'),
            subject: 'Weekly update',
            body: 'Here is the update.',
            sentAt: null,
            sent: false,
        })

        expect(mapEmailNotificationToInsert(notification).sent_at).toBeNull()
    })
})

describe('mapNotificationJobToInsert', () => {
    const baseJob: NotificationJob = {
        jobId: 'j1',
        parentId: 'p1',
        studentId: 's1',
        summaryId: 'sum1',
        emailNotificationId: 'n1',
        scheduledFor: new Date('2026-07-25T09:30:00.000Z'),
        status: 'pending',
        attempts: 0,
        leaseExpiresAt: null,
        completedAt: null,
        failedAt: null,
        retryAt: null,
        lastError: null,
    }

    it('maps a job with null optional timestamps and a lease owner', () => {
        const insert = mapNotificationJobToInsert(baseJob, 'worker-1')

        expect(insert).toMatchObject({
            job_id: 'j1',
            scheduled_for: '2026-07-25T09:30:00.000Z',
            lease_owner: 'worker-1',
            lease_expires_at: null,
            completed_at: null,
            failed_at: null,
            retry_at: null,
        })
    })

    it('serialises present optional timestamps', () => {
        const insert = mapNotificationJobToInsert(
            { ...baseJob, completedAt: new Date('2026-07-25T10:00:00.000Z') },
            null,
        )

        expect(insert.completed_at).toBe('2026-07-25T10:00:00.000Z')
        expect(insert.lease_owner).toBeNull()
    })
})

describe('mapAuditEventToInsert', () => {
    it('maps an AuditEvent into an audit_events insert', () => {
        const event: AuditEvent = {
            eventId: 'e1',
            actorSubject: 'auth-1',
            action: 'progress.ingested',
            entityType: 'progress_record',
            entityId: 'r1',
            occurredAt: new Date('2026-07-25T09:30:00.000Z'),
            metadata: { source: 'sms' },
        }

        expect(mapAuditEventToInsert(event)).toEqual({
            event_id: 'e1',
            actor_user_id: 'auth-1',
            action: 'progress.ingested',
            entity_type: 'progress_record',
            entity_id: 'r1',
            occurred_at: '2026-07-25T09:30:00.000Z',
            metadata: { source: 'sms' },
        })
    })
})

describe('mapIdempotencyInputToInsert', () => {
    it('maps an idempotency input into a processing insert', () => {
        const input: IdempotencyRecordInput = {
            scope: 'ingestion',
            operation: 'record-progress',
            idempotencyKey: 'key-1',
            requestHash: 'a'.repeat(64),
            expiresAt: new Date('2026-07-26T09:30:00.000Z'),
        }

        expect(mapIdempotencyInputToInsert(input)).toEqual({
            scope: 'ingestion',
            operation: 'record-progress',
            idempotency_key: 'key-1',
            request_hash: 'a'.repeat(64),
            status: 'processing',
            expires_at: '2026-07-26T09:30:00.000Z',
            response_status: null,
            response_body: null,
            completed_at: null,
            failed_at: null,
        })
    })
})

describe('mapIdempotencyTerminalToUpdate', () => {
    const timestamp = new Date('2026-07-25T09:30:00.000Z')

    it('builds a completed update with completed_at set and failed_at null', () => {
        const update = mapIdempotencyTerminalToUpdate(
            'completed',
            200,
            { ok: true },
            timestamp,
        )

        expect(update).toEqual({
            status: 'completed',
            response_status: 200,
            response_body: { ok: true },
            completed_at: '2026-07-25T09:30:00.000Z',
            failed_at: null,
        })
    })

    it('builds a failed update with failed_at set and completed_at null', () => {
        const update = mapIdempotencyTerminalToUpdate(
            'failed',
            500,
            null,
            timestamp,
        )

        expect(update).toEqual({
            status: 'failed',
            response_status: 500,
            response_body: null,
            completed_at: null,
            failed_at: '2026-07-25T09:30:00.000Z',
        })
    })
})
