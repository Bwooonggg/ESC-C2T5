import { describe, expect, it } from '@jest/globals'
import {
    mapAuditEventRow,
    mapEmailNotificationRow,
    mapNotificationJobRow,
    mapNotificationPreferenceRow,
    mapParentRow,
    mapProgressRecordRow,
    mapRecommendationRow,
    mapStudentRow,
    mapSummaryRow,
    mapUserRow,
    MysqlRowMappingError,
} from '../../../src/infrastructure/mysql/mappers/index.js'

const userRow = {
    user_id: 'u1',
    email: 'Parent@Example.com',
    mobile_number: '+6512345678',
    password_hash: 'deferred-auth-placeholder',
    account_type: 'parent',
    is_verified: 1,
}

describe('MySQL row mappers', () => {
    it('maps identity, parent, and student rows into domain entities', () => {
        const user = mapUserRow(userRow)
        const parent = mapParentRow({
            ...userRow,
            parent_id: 'p1',
            name: 'A Parent',
            student_ids: ['s1', 's2'],
        })
        const student = mapStudentRow({
            student_id: 's1',
            name: 'A Student',
            date_of_birth: '2015-04-10',
            band_level: 'Band 3',
            current_progress_version: 'progress-v2',
        })

        expect(user.email.value).toBe('parent@example.com')
        expect(user.isVerified).toBe(true)
        expect(parent.parentId).toBe('p1')
        expect(parent.studentIds).toEqual(['s1', 's2'])
        expect(student.dateOfBirth.toISOString()).toBe(
            '2015-04-10T00:00:00.000Z',
        )
        expect(student.currentProgressVersion).toBe('progress-v2')
    })

    it('maps progress, summary, and recommendation rows', () => {
        const progress = mapProgressRecordRow({
            record_id: 'r1',
            student_id: 's1',
            assessment_date: '2026-07-23',
            skill_area: 'Reading Fluency',
            score: '84.12',
            notes: 'Improving steadily.',
        })
        const summary = mapSummaryRow({
            summary_id: 'sum1',
            student_id: 's1',
            content: 'The student is progressing well.',
            generated_at: '2026-07-23 12:00:00.000',
            source_progress_version: 'progress-v2',
        })
        const recommendation = mapRecommendationRow({
            recommendation_id: 'rec1',
            student_id: 's1',
            summary_id: 'sum1',
            content: 'Continue daily reading practice.',
            generated_at: new Date('2026-07-23T12:01:00.000Z'),
        })

        expect(progress.skillArea.value).toBe('Reading Fluency')
        expect(progress.score).toBe(84.12)
        expect(progress.date.toISOString()).toBe(
            '2026-07-23T00:00:00.000Z',
        )
        expect(summary.sourceProgressVersion).toBe('progress-v2')
        expect(summary.generatedAt.toISOString()).toBe(
            '2026-07-23T12:00:00.000Z',
        )
        expect(recommendation.summaryId).toBe('sum1')
    })

    it('maps notification preferences and delivery state', () => {
        const preference = mapNotificationPreferenceRow({
            parent_id: 'p1',
            enabled: '0',
            frequency: 'Monthly',
            recipient_email: 'Parent@Example.com',
        })
        const notification = mapEmailNotificationRow({
            notification_id: 'n1',
            parent_id: 'p1',
            summary_id: 'sum1',
            recipient_email: 'Parent@Example.com',
            subject: 'Progress update',
            body: 'Progress summary',
            sent_at: null,
            sent: false,
        })

        expect(preference.enabled).toBe(false)
        expect(preference.frequency.value).toBe('Monthly')
        expect(preference.recipientEmail.value).toBe('parent@example.com')
        expect(notification.sent).toBe(false)
        expect(notification.sentAt).toBeNull()
    })

    it('maps worker jobs and audit metadata', () => {
        const job = mapNotificationJobRow({
            job_id: 'job1',
            parent_id: 'p1',
            student_id: 's1',
            summary_id: 'sum1',
            email_notification_id: 'n1',
            scheduled_for: '2026-07-24 12:00:00.000',
            status: 'failed',
            attempts: '2',
            lease_expires_at: null,
            completed_at: null,
            failed_at: '2026-07-24 12:01:00.000',
            retry_at: '2026-07-24 12:05:00.000',
            last_error: 'Provider unavailable',
        })
        const audit = mapAuditEventRow({
            event_id: 'event1',
            actor_user_id: null,
            action: 'progress.created',
            entity_type: 'ProgressRecord',
            entity_id: 'r1',
            occurred_at: '2026-07-23 12:00:00.000',
            metadata: '{"source":"integration-test"}',
        })

        expect(job.status).toBe('failed')
        expect(job.attempts).toBe(2)
        expect(job.retryAt?.toISOString()).toBe(
            '2026-07-24T12:05:00.000Z',
        )
        expect(audit.metadata).toEqual({ source: 'integration-test' })
        expect(Object.isFrozen(audit.metadata)).toBe(true)
    })

    it('rejects malformed database values before they reach application code', () => {
        expect(() =>
            mapProgressRecordRow({
                record_id: 'r1',
                student_id: 's1',
                assessment_date: '2026-07-23',
                skill_area: 'Reading Fluency',
                score: 'not-a-number',
                notes: '',
            }),
        ).toThrow(MysqlRowMappingError)

        expect(() =>
            mapNotificationJobRow({
                job_id: 'job1',
                parent_id: 'p1',
                student_id: 's1',
                summary_id: null,
                email_notification_id: null,
                scheduled_for: '2026-07-24 12:00:00.000',
                status: 'unknown',
                attempts: 0,
                lease_expires_at: null,
                completed_at: null,
                failed_at: null,
                retry_at: null,
                last_error: null,
            }),
        ).toThrow(MysqlRowMappingError)

        expect(() =>
            mapAuditEventRow({
                event_id: 'event1',
                actor_user_id: null,
                action: 'progress.created',
                entity_type: 'ProgressRecord',
                entity_id: 'r1',
                occurred_at: '2026-07-23 12:00:00.000',
                metadata: 'not-json',
            }),
        ).toThrow(MysqlRowMappingError)
    })
})
