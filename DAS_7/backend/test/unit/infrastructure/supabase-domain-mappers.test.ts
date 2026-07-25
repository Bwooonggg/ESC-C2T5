import { describe, expect, it } from '@jest/globals'
import {
    mapAuditEventRow,
    mapEmailNotificationRow,
    mapIdempotencyRecordRow,
    mapNotificationJobRow,
    mapNotificationPreferenceRow,
    mapParentRow,
    mapProgressRecordRow,
    mapRecommendationRow,
    mapStudentRow,
    mapSummaryRow,
} from '../../../src/infrastructure/supabase/mappers/domain-mappers.js'
import { SupabaseRowMappingError } from '../../../src/infrastructure/supabase/errors.js'
import type {
    AuditEventRow,
    EmailNotificationRow,
    IdempotencyRecordRow,
    NotificationJobRow,
    NotificationPreferenceRow,
    ParentProfileRow,
    ProgressRecordRow,
    RecommendationRow,
    StudentProfileRow,
    SummaryRow,
} from '../../../src/infrastructure/supabase/mappers/row-schemas.js'

// The mapper functions read named fields off the row without re-validating the
// full generated Row shape, so fixtures cast through `unknown` are sufficient.
const asRow = <T>(value: Record<string, unknown>): T => value as unknown as T

describe('mapParentRow', () => {
    it('maps a parent profile row into a Parent entity', () => {
        const parent = mapParentRow(
            asRow<ParentProfileRow>({
                parent_id: 'p1',
                auth_user_id: 'auth-1',
                name: 'A Parent',
            }),
        )

        expect(parent.parentId).toBe('p1')
        expect(parent.authUserId).toBe('auth-1')
        expect(parent.name).toBe('A Parent')
    })
})

describe('mapStudentRow', () => {
    const validRow = {
        student_id: 's1',
        name: 'A Student',
        date_of_birth: '2015-04-10',
        band_level: 'Band 3',
        current_progress_version: 2,
    }

    it('maps a student profile row, coercing the progress version to text', () => {
        const student = mapStudentRow(asRow<StudentProfileRow>(validRow))

        expect(student.studentId).toBe('s1')
        expect(student.dateOfBirth.toISOString()).toBe(
            '2015-04-10T00:00:00.000Z',
        )
        expect(student.currentProgressVersion).toBe('2')
    })

    it('throws when the date of birth is not a valid PostgreSQL date', () => {
        expect(() =>
            mapStudentRow(
                asRow<StudentProfileRow>({
                    ...validRow,
                    date_of_birth: '2015-02-30',
                }),
            ),
        ).toThrow(SupabaseRowMappingError)
    })
})

describe('mapProgressRecordRow', () => {
    const validRow = {
        record_id: 'r1',
        student_id: 's1',
        assessment_date: '2026-07-23',
        skill_area: 'Reading Fluency',
        score: 84.12,
        notes: 'Improving steadily.',
    }

    it('maps a progress record row into a ProgressRecord entity', () => {
        const record = mapProgressRecordRow(asRow<ProgressRecordRow>(validRow))

        expect(record.recordId).toBe('r1')
        expect(record.skillArea.value).toBe('Reading Fluency')
        expect(record.score).toBe(84.12)
    })

    it('throws when the assessment date is invalid', () => {
        expect(() =>
            mapProgressRecordRow(
                asRow<ProgressRecordRow>({
                    ...validRow,
                    assessment_date: 'not-a-date',
                }),
            ),
        ).toThrow(SupabaseRowMappingError)
    })
})

describe('mapSummaryRow', () => {
    const validRow = {
        summary_id: 'sum1',
        student_id: 's1',
        content: 'A generated summary.',
        generated_at: '2026-07-25T09:30:00.000Z',
        source_progress_version: 3,
    }

    it('maps a summary row into a Summary entity', () => {
        const summary = mapSummaryRow(asRow<SummaryRow>(validRow))

        expect(summary.summaryId).toBe('sum1')
        expect(summary.generatedAt.toISOString()).toBe(
            '2026-07-25T09:30:00.000Z',
        )
        expect(summary.sourceProgressVersion).toBe('3')
    })

    it('throws when generated_at is not a valid timestamp', () => {
        expect(() =>
            mapSummaryRow(
                asRow<SummaryRow>({ ...validRow, generated_at: 'nope' }),
            ),
        ).toThrow(SupabaseRowMappingError)
    })
})

describe('mapRecommendationRow', () => {
    it('maps a recommendation row into a Recommendation entity', () => {
        const recommendation = mapRecommendationRow(
            asRow<RecommendationRow>({
                recommendation_id: 'rec1',
                student_id: 's1',
                summary_id: 'sum1',
                content: 'Practice reading aloud.',
                generated_at: '2026-07-25T09:30:00.000Z',
            }),
        )

        expect(recommendation.recommendationId).toBe('rec1')
        expect(recommendation.summaryId).toBe('sum1')
        expect(recommendation.generatedAt.toISOString()).toBe(
            '2026-07-25T09:30:00.000Z',
        )
    })
})

describe('mapNotificationPreferenceRow', () => {
    it('maps a preference row into a NotificationPreference entity', () => {
        const preference = mapNotificationPreferenceRow(
            asRow<NotificationPreferenceRow>({
                parent_id: 'p1',
                enabled: true,
                frequency: 'Weekly',
                recipient_email: 'Parent@Example.com',
            }),
        )

        expect(preference.parentId).toBe('p1')
        expect(preference.enabled).toBe(true)
        expect(preference.frequency.value).toBe('Weekly')
        expect(preference.recipientEmail.value).toBe('parent@example.com')
    })
})

describe('mapEmailNotificationRow', () => {
    const baseRow = {
        notification_id: 'n1',
        parent_id: 'p1',
        student_id: 's1',
        summary_id: 'sum1',
        recipient_email: 'parent@example.com',
        subject: 'Weekly update',
        body: 'Here is the update.',
    }

    it('maps an unsent notification with a null sentAt', () => {
        const notification = mapEmailNotificationRow(
            asRow<EmailNotificationRow>({
                ...baseRow,
                sent_at: null,
                sent: false,
            }),
        )

        expect(notification.sent).toBe(false)
        expect(notification.sentAt).toBeNull()
    })

    it('maps a sent notification with a parsed sentAt timestamp', () => {
        const notification = mapEmailNotificationRow(
            asRow<EmailNotificationRow>({
                ...baseRow,
                sent_at: '2026-07-25T09:30:00.000Z',
                sent: true,
            }),
        )

        expect(notification.sent).toBe(true)
        expect(notification.sentAt?.toISOString()).toBe(
            '2026-07-25T09:30:00.000Z',
        )
    })

    it('throws when sent_at is present but not a valid timestamp', () => {
        expect(() =>
            mapEmailNotificationRow(
                asRow<EmailNotificationRow>({
                    ...baseRow,
                    sent_at: 'invalid',
                    sent: true,
                }),
            ),
        ).toThrow(SupabaseRowMappingError)
    })
})

describe('mapNotificationJobRow', () => {
    const validRow = {
        job_id: 'j1',
        parent_id: 'p1',
        student_id: 's1',
        summary_id: 'sum1',
        email_notification_id: 'n1',
        scheduled_for: '2026-07-25T09:30:00.000Z',
        status: 'pending',
        attempts: 0,
        lease_expires_at: null,
        completed_at: null,
        failed_at: null,
        retry_at: null,
        last_error: null,
    }

    it('maps a notification job row, preserving null optional timestamps', () => {
        const job = mapNotificationJobRow(asRow<NotificationJobRow>(validRow))

        expect(job.jobId).toBe('j1')
        expect(job.status).toBe('pending')
        expect(job.scheduledFor.toISOString()).toBe('2026-07-25T09:30:00.000Z')
        expect(job.leaseExpiresAt).toBeNull()
        expect(job.completedAt).toBeNull()
    })

    it('parses a present optional timestamp', () => {
        const job = mapNotificationJobRow(
            asRow<NotificationJobRow>({
                ...validRow,
                completed_at: '2026-07-25T10:00:00.000Z',
            }),
        )

        expect(job.completedAt?.toISOString()).toBe('2026-07-25T10:00:00.000Z')
    })

    it('throws when a required timestamp is invalid', () => {
        expect(() =>
            mapNotificationJobRow(
                asRow<NotificationJobRow>({
                    ...validRow,
                    scheduled_for: 'invalid',
                }),
            ),
        ).toThrow(SupabaseRowMappingError)
    })
})

describe('mapAuditEventRow', () => {
    it('maps an audit event row into an AuditEvent', () => {
        const event = mapAuditEventRow(
            asRow<AuditEventRow>({
                event_id: 'e1',
                actor_user_id: 'auth-1',
                action: 'progress.ingested',
                entity_type: 'progress_record',
                entity_id: 'r1',
                occurred_at: '2026-07-25T09:30:00.000Z',
                metadata: { source: 'sms' },
            }),
        )

        expect(event.eventId).toBe('e1')
        expect(event.actorSubject).toBe('auth-1')
        expect(event.occurredAt.toISOString()).toBe('2026-07-25T09:30:00.000Z')
        expect(event.metadata).toEqual({ source: 'sms' })
    })
})

describe('mapIdempotencyRecordRow', () => {
    const validRow = {
        scope: 'ingestion',
        operation: 'record-progress',
        idempotency_key: 'key-1',
        request_hash: 'a'.repeat(64),
        status: 'completed',
        response_status: 200,
        response_body: { ok: true },
        expires_at: '2026-07-26T09:30:00.000Z',
        completed_at: '2026-07-25T09:30:00.000Z',
        failed_at: null,
        created_at: '2026-07-25T09:00:00.000Z',
    }

    it('maps an idempotency record row into an IdempotencyRecord', () => {
        const record = mapIdempotencyRecordRow(
            asRow<IdempotencyRecordRow>(validRow),
        )

        expect(record.idempotencyKey).toBe('key-1')
        expect(record.status).toBe('completed')
        expect(record.responseBody).toEqual({ ok: true })
        expect(record.completedAt?.toISOString()).toBe(
            '2026-07-25T09:30:00.000Z',
        )
        expect(record.failedAt).toBeNull()
    })

    it('maps a null response body to null', () => {
        const record = mapIdempotencyRecordRow(
            asRow<IdempotencyRecordRow>({ ...validRow, response_body: null }),
        )

        expect(record.responseBody).toBeNull()
    })

    it('throws when the response body is not a JSON object', () => {
        expect(() =>
            mapIdempotencyRecordRow(
                asRow<IdempotencyRecordRow>({
                    ...validRow,
                    response_body: ['not', 'an', 'object'],
                }),
            ),
        ).toThrow(SupabaseRowMappingError)
    })
})
