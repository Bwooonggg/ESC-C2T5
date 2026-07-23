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
import {
    type MysqlRow,
    readBoolean,
    readDate,
    readNullableDate,
    readNumber,
    readOptionalStringArray,
    readString,
} from './database-row.js'

/**
 * Maps the transitional MySQL parent join into the platform-owned projection.
 * The legacy `users` row contributes only its opaque identity identifier;
 * credentials and local role state are intentionally ignored.
 */
export function mapParentRow(row: MysqlRow): Parent {
    return new Parent({
        parentId: readString(row, 'parent_id'),
        authUserId: readAuthUserId(row),
        name: readString(row, 'name'),
        studentIds: readOptionalStringArray(row, 'student_ids'),
    })
}

export function mapStudentRow(row: MysqlRow): Student {
    return new Student({
        studentId: readString(row, 'student_id'),
        name: readString(row, 'name'),
        dateOfBirth: readDate(row, 'date_of_birth'),
        bandLevel: readString(row, 'band_level'),
        currentProgressVersion: readString(
            row,
            'current_progress_version',
        ),
    })
}

export function mapProgressRecordRow(row: MysqlRow): ProgressRecord {
    return new ProgressRecord({
        recordId: readString(row, 'record_id'),
        studentId: readString(row, 'student_id'),
        date: readDate(row, 'assessment_date'),
        skillArea: new SkillArea(readString(row, 'skill_area')),
        score: readNumber(row, 'score'),
        notes: readString(row, 'notes'),
    })
}

export function mapSummaryRow(row: MysqlRow): Summary {
    return new Summary({
        summaryId: readString(row, 'summary_id'),
        studentId: readString(row, 'student_id'),
        content: readString(row, 'content'),
        generatedAt: readDate(row, 'generated_at'),
        sourceProgressVersion: readString(row, 'source_progress_version'),
    })
}

export function mapRecommendationRow(row: MysqlRow): Recommendation {
    return new Recommendation({
        recommendationId: readString(row, 'recommendation_id'),
        studentId: readString(row, 'student_id'),
        summaryId: readString(row, 'summary_id'),
        content: readString(row, 'content'),
        generatedAt: readDate(row, 'generated_at'),
    })
}

export function mapNotificationPreferenceRow(
    row: MysqlRow,
): NotificationPreference {
    return new NotificationPreference({
        parentId: readString(row, 'parent_id'),
        enabled: readBoolean(row, 'enabled'),
        frequency: new NotificationFrequency(
            readString(row, 'frequency'),
        ),
        recipientEmail: new EmailAddress(
            readString(row, 'recipient_email'),
        ),
    })
}

export function mapEmailNotificationRow(
    row: MysqlRow,
): EmailNotification {
    return new EmailNotification({
        notificationId: readString(row, 'notification_id'),
        parentId: readString(row, 'parent_id'),
        studentId: readString(row, 'student_id'),
        summaryId: readString(row, 'summary_id'),
        recipientEmail: new EmailAddress(
            readString(row, 'recipient_email'),
        ),
        subject: readString(row, 'subject'),
        body: readString(row, 'body'),
        sentAt: readNullableDate(row, 'sent_at'),
        sent: readBoolean(row, 'sent'),
    })
}

function readAuthUserId(row: MysqlRow): string {
    if (row.auth_user_id !== undefined) {
        return readString(row, 'auth_user_id')
    }

    return readString(row, 'user_id')
}
