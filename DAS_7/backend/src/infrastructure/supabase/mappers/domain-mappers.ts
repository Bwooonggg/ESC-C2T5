import { EmailNotification } from '../../../domain/entities/email-notification.js'
import { NotificationPreference } from '../../../domain/entities/notification-preference.js'
import { Parent } from '../../../domain/entities/parent.js'
import { ProgressRecord } from '../../../domain/entities/progress-record.js'
import { Recommendation } from '../../../domain/entities/recommendation.js'
import { Student } from '../../../domain/entities/student.js'
import { Summary } from '../../../domain/entities/summary.js'
import { EmailAddress } from '../../../domain/value-objects/email-address.js'
import { NotificationFrequency } from '../../../domain/value-objects/notification-frequency.js'
import { SkillArea } from '../../../domain/value-objects/skill-area.js'
import type {
    AuditEvent,
} from '../../../modules/ingestion/ports/audit.repository.js'
import type {
    IdempotencyRecord,
    IdempotencyStatus,
} from '../../../modules/ingestion/ports/idempotency.repository.js'
import type {
    NotificationJob,
    NotificationJobStatus,
} from '../../../modules/notifications/ports/notification-job.repository.js'
import {
    parsePostgresDate,
    parsePostgresTimestamp,
} from './date-conversions.js'
import { SupabaseRowMappingError } from '../errors.js'
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
} from './row-schemas.js'

export function mapParentRow(row: ParentProfileRow): Parent {
    return new Parent({
        parentId: row.parent_id,
        authUserId: row.auth_user_id,
        name: row.name,
    })
}

export function mapStudentRow(row: StudentProfileRow): Student {
    return new Student({
        studentId: row.student_id,
        name: row.name,
        dateOfBirth: parsePostgresDate(
            row.date_of_birth,
            'student_profiles',
            'date_of_birth',
        ),
        bandLevel: row.band_level,
        currentProgressVersion: String(row.current_progress_version),
    })
}

export function mapProgressRecordRow(
    row: ProgressRecordRow,
): ProgressRecord {
    return new ProgressRecord({
        recordId: row.record_id,
        studentId: row.student_id,
        date: parsePostgresDate(
            row.assessment_date,
            'progress_records',
            'assessment_date',
        ),
        skillArea: new SkillArea(row.skill_area),
        score: row.score,
        notes: row.notes,
    })
}

export function mapSummaryRow(row: SummaryRow): Summary {
    return new Summary({
        summaryId: row.summary_id,
        studentId: row.student_id,
        content: row.content,
        generatedAt: parsePostgresTimestamp(
            row.generated_at,
            'summaries',
            'generated_at',
        ),
        sourceProgressVersion: String(row.source_progress_version),
    })
}

export function mapRecommendationRow(
    row: RecommendationRow,
): Recommendation {
    return new Recommendation({
        recommendationId: row.recommendation_id,
        studentId: row.student_id,
        summaryId: row.summary_id,
        content: row.content,
        generatedAt: parsePostgresTimestamp(
            row.generated_at,
            'recommendations',
            'generated_at',
        ),
    })
}

export function mapNotificationPreferenceRow(
    row: NotificationPreferenceRow,
): NotificationPreference {
    return new NotificationPreference({
        parentId: row.parent_id,
        enabled: row.enabled,
        frequency: new NotificationFrequency(row.frequency),
        recipientEmail: new EmailAddress(row.recipient_email),
    })
}

export function mapEmailNotificationRow(
    row: EmailNotificationRow,
): EmailNotification {
    return new EmailNotification({
        notificationId: row.notification_id,
        parentId: row.parent_id,
        studentId: row.student_id,
        summaryId: row.summary_id,
        recipientEmail: new EmailAddress(row.recipient_email),
        subject: row.subject,
        body: row.body,
        sentAt:
            row.sent_at === null
                ? null
                : parsePostgresTimestamp(
                      row.sent_at,
                      'email_notifications',
                      'sent_at',
                  ),
        sent: row.sent,
    })
}

export function mapNotificationJobRow(
    row: NotificationJobRow,
): NotificationJob {
    return {
        jobId: row.job_id,
        parentId: row.parent_id,
        studentId: row.student_id,
        summaryId: row.summary_id,
        emailNotificationId: row.email_notification_id,
        scheduledFor: parsePostgresTimestamp(
            row.scheduled_for,
            'notification_jobs',
            'scheduled_for',
        ),
        status: row.status as NotificationJobStatus,
        attempts: row.attempts,
        leaseExpiresAt: nullableTimestamp(
            row.lease_expires_at,
            'notification_jobs',
            'lease_expires_at',
        ),
        completedAt: nullableTimestamp(
            row.completed_at,
            'notification_jobs',
            'completed_at',
        ),
        failedAt: nullableTimestamp(
            row.failed_at,
            'notification_jobs',
            'failed_at',
        ),
        retryAt: nullableTimestamp(
            row.retry_at,
            'notification_jobs',
            'retry_at',
        ),
        lastError: row.last_error,
    }
}

export function mapAuditEventRow(row: AuditEventRow): AuditEvent {
    return {
        eventId: row.event_id,
        actorSubject: row.actor_user_id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        occurredAt: parsePostgresTimestamp(
            row.occurred_at,
            'audit_events',
            'occurred_at',
        ),
        metadata: row.metadata as Readonly<Record<string, unknown>>,
    }
}

export function mapIdempotencyRecordRow(
    row: IdempotencyRecordRow,
): IdempotencyRecord {
    return {
        scope: row.scope,
        operation: row.operation,
        idempotencyKey: row.idempotency_key,
        requestHash: row.request_hash,
        status: row.status as IdempotencyStatus,
        responseStatus: row.response_status,
        responseBody: toNullableJsonObject(row.response_body),
        expiresAt: parsePostgresTimestamp(
            row.expires_at,
            'idempotency_records',
            'expires_at',
        ),
        completedAt: nullableTimestamp(
            row.completed_at,
            'idempotency_records',
            'completed_at',
        ),
        failedAt: nullableTimestamp(
            row.failed_at,
            'idempotency_records',
            'failed_at',
        ),
        createdAt: parsePostgresTimestamp(
            row.created_at,
            'idempotency_records',
            'created_at',
        ),
    }
}

function nullableTimestamp(
    value: string | null,
    table: string,
    field: string,
): Date | null {
    return value === null ? null : parsePostgresTimestamp(value, table, field)
}

function toNullableJsonObject(
    value: IdempotencyRecordRow['response_body'],
): Readonly<Record<string, unknown>> | null {
    if (value === null) {
        return null
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new SupabaseRowMappingError(
            'idempotency_records',
            'response_body must be a JSON object.',
        )
    }

    return value as { readonly [key: string]: unknown }
}
