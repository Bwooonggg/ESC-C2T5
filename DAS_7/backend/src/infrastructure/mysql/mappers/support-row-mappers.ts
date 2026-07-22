import type { AuditEvent } from '../../../modules/ingestion/ports/audit.repository.js'
import type {
    NotificationJob,
    NotificationJobStatus,
} from '../../../modules/notifications/ports/notification-job.repository.js'
import {
    type MysqlRow,
    readDate,
    readInteger,
    readJsonObject,
    readKnownValue,
    readNullableDate,
    readNullableString,
    readString,
} from './database-row.js'

const NOTIFICATION_JOB_STATUS_VALUES = [
    'pending',
    'processing',
    'completed',
    'failed',
] as const satisfies readonly NotificationJobStatus[]

export function mapNotificationJobRow(row: MysqlRow): NotificationJob {
    return {
        jobId: readString(row, 'job_id'),
        parentId: readString(row, 'parent_id'),
        studentId: readString(row, 'student_id'),
        summaryId: readNullableString(row, 'summary_id'),
        emailNotificationId: readNullableString(
            row,
            'email_notification_id',
        ),
        scheduledFor: readDate(row, 'scheduled_for'),
        status: readKnownValue(
            row,
            'status',
            NOTIFICATION_JOB_STATUS_VALUES,
        ),
        attempts: readInteger(row, 'attempts'),
        leaseExpiresAt: readNullableDate(row, 'lease_expires_at'),
        completedAt: readNullableDate(row, 'completed_at'),
        failedAt: readNullableDate(row, 'failed_at'),
        retryAt: readNullableDate(row, 'retry_at'),
        lastError: readNullableString(row, 'last_error'),
    }
}

export function mapAuditEventRow(row: MysqlRow): AuditEvent {
    return {
        eventId: readString(row, 'event_id'),
        actorUserId: readNullableString(row, 'actor_user_id'),
        action: readString(row, 'action'),
        entityType: readString(row, 'entity_type'),
        entityId: readString(row, 'entity_id'),
        occurredAt: readDate(row, 'occurred_at'),
        metadata: readJsonObject(row, 'metadata'),
    }
}
