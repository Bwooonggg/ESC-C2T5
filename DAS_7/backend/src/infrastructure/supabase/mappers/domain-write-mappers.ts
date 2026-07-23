import type { Database } from '../generated/database.types.js'
import type { AuditEvent } from '../../../modules/ingestion/ports/audit.repository.js'
import type {
    IdempotencyRecordInput,
} from '../../../modules/ingestion/ports/idempotency.repository.js'
import type {
    NotificationJob,
} from '../../../modules/notifications/ports/notification-job.repository.js'
import type { EmailNotification } from '../../../domain/entities/email-notification.js'
import type { NotificationPreference } from '../../../domain/entities/notification-preference.js'
import type { Parent } from '../../../domain/entities/parent.js'
import type { Recommendation } from '../../../domain/entities/recommendation.js'
import type { Student } from '../../../domain/entities/student.js'
import type { Summary } from '../../../domain/entities/summary.js'
import { toPostgresDate, toPostgresTimestamp } from './date-conversions.js'
import {
    asJsonObject,
    asNullableJsonObject,
    toProgressVersion,
} from './write-support.js'

type InsightTables = Database['insight']['Tables']
type ParentProfileInsert = InsightTables['parent_profiles']['Insert']
type ParentStudentInsert = InsightTables['parent_students']['Insert']
type StudentProfileInsert = InsightTables['student_profiles']['Insert']
type SummaryInsert = InsightTables['summaries']['Insert']
type RecommendationInsert = InsightTables['recommendations']['Insert']
type PreferenceInsert = InsightTables['notification_preferences']['Insert']
type EmailNotificationInsert = InsightTables['email_notifications']['Insert']
type NotificationJobInsert = InsightTables['notification_jobs']['Insert']
type AuditEventInsert = InsightTables['audit_events']['Insert']
type IdempotencyInsert = InsightTables['idempotency_records']['Insert']
type IdempotencyUpdate = InsightTables['idempotency_records']['Update']

export function mapParentToInsert(parent: Parent): ParentProfileInsert {
    return {
        parent_id: parent.parentId,
        auth_user_id: parent.authUserId,
        name: parent.name,
    }
}

export function mapParentStudentToInsert(
    parentId: string,
    studentId: string,
): ParentStudentInsert {
    return { parent_id: parentId, student_id: studentId }
}

export function mapStudentToInsert(student: Student): StudentProfileInsert {
    return {
        student_id: student.studentId,
        name: student.name,
        date_of_birth: toPostgresDate(student.dateOfBirth, 'dateOfBirth'),
        band_level: student.bandLevel,
        current_progress_version: toProgressVersion(
            student.currentProgressVersion,
            'currentProgressVersion',
        ),
    }
}

export function mapSummaryToInsert(summary: Summary): SummaryInsert {
    return {
        summary_id: summary.summaryId,
        student_id: summary.studentId,
        content: summary.content,
        generated_at: toPostgresTimestamp(summary.generatedAt, 'generatedAt'),
        source_progress_version: toProgressVersion(
            summary.sourceProgressVersion,
            'sourceProgressVersion',
        ),
        generation_metadata: asJsonObject({}),
    }
}

export function mapRecommendationToInsert(
    recommendation: Recommendation,
): RecommendationInsert {
    return {
        recommendation_id: recommendation.recommendationId,
        student_id: recommendation.studentId,
        summary_id: recommendation.summaryId,
        content: recommendation.content,
        generated_at: toPostgresTimestamp(
            recommendation.generatedAt,
            'generatedAt',
        ),
        generation_metadata: asJsonObject({}),
    }
}

export function mapPreferenceToInsert(
    preference: NotificationPreference,
): PreferenceInsert {
    return {
        parent_id: preference.parentId,
        enabled: preference.enabled,
        frequency: preference.frequency.value,
        recipient_email: preference.recipientEmail.value,
    }
}

export function mapEmailNotificationToInsert(
    notification: EmailNotification,
): EmailNotificationInsert {
    return {
        notification_id: notification.notificationId,
        parent_id: notification.parentId,
        student_id: notification.studentId,
        summary_id: notification.summaryId,
        recipient_email: notification.recipientEmail.value,
        subject: notification.subject,
        body: notification.body,
        sent_at:
            notification.sentAt === null
                ? null
                : toPostgresTimestamp(notification.sentAt, 'sentAt'),
        sent: notification.sent,
        provider_message_id: null,
    }
}

export function mapNotificationJobToInsert(
    job: NotificationJob,
    leaseOwner: string | null,
): NotificationJobInsert {
    return {
        job_id: job.jobId,
        parent_id: job.parentId,
        student_id: job.studentId,
        summary_id: job.summaryId,
        email_notification_id: job.emailNotificationId,
        scheduled_for: toPostgresTimestamp(job.scheduledFor, 'scheduledFor'),
        status: job.status,
        attempts: job.attempts,
        lease_owner: leaseOwner,
        lease_expires_at:
            job.leaseExpiresAt === null
                ? null
                : toPostgresTimestamp(job.leaseExpiresAt, 'leaseExpiresAt'),
        completed_at:
            job.completedAt === null
                ? null
                : toPostgresTimestamp(job.completedAt, 'completedAt'),
        failed_at:
            job.failedAt === null
                ? null
                : toPostgresTimestamp(job.failedAt, 'failedAt'),
        retry_at:
            job.retryAt === null
                ? null
                : toPostgresTimestamp(job.retryAt, 'retryAt'),
        last_error: job.lastError,
    }
}

export function mapAuditEventToInsert(event: AuditEvent): AuditEventInsert {
    return {
        event_id: event.eventId,
        actor_user_id: event.actorSubject,
        action: event.action,
        entity_type: event.entityType,
        entity_id: event.entityId,
        occurred_at: toPostgresTimestamp(event.occurredAt, 'occurredAt'),
        metadata: asJsonObject(event.metadata),
    }
}

export function mapIdempotencyInputToInsert(
    record: IdempotencyRecordInput,
): IdempotencyInsert {
    return {
        scope: record.scope,
        operation: record.operation,
        idempotency_key: record.idempotencyKey,
        request_hash: record.requestHash,
        status: 'processing',
        expires_at: toPostgresTimestamp(record.expiresAt, 'expiresAt'),
        response_status: null,
        response_body: null,
        completed_at: null,
        failed_at: null,
    }
}

export function mapIdempotencyTerminalToUpdate(
    status: 'completed' | 'failed',
    responseStatus: number,
    responseBody: Readonly<Record<string, unknown>> | null,
    timestamp: Date,
): IdempotencyUpdate {
    return status === 'completed'
        ? {
              status,
              response_status: responseStatus,
              response_body: asNullableJsonObject(responseBody),
              completed_at: toPostgresTimestamp(timestamp, 'completedAt'),
              failed_at: null,
          }
        : {
              status,
              response_status: responseStatus,
              response_body: asNullableJsonObject(responseBody),
              completed_at: null,
              failed_at: toPostgresTimestamp(timestamp, 'failedAt'),
          }
}
