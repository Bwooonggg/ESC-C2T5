import type { RowDataPacket } from 'mysql2/promise'
import type { EmailNotification } from '../../../domain/entities/email-notification.js'
import type { EmailNotificationRepository } from '../../../modules/notifications/ports/email-notification.repository.js'
import { mapEmailNotificationRow } from '../mappers/index.js'
import {
    asMysqlRow,
    executeRows,
    executeStatement,
    type MySqlExecutor,
} from './mysql-repository.js'

interface EmailNotificationRow extends RowDataPacket {}

export class MySqlEmailNotificationRepository
    implements EmailNotificationRepository
{
    constructor(private readonly executor: MySqlExecutor) {}

    async findById(
        notificationId: string,
    ): Promise<EmailNotification | null> {
        const rows = await executeRows<EmailNotificationRow>(
            this.executor,
            `
                SELECT
                    notification_id, parent_id, student_id, summary_id, recipient_email,
                    subject, body, sent_at, sent
                FROM email_notifications
                WHERE notification_id = ?
                LIMIT 1
            `,
            [notificationId],
        )

        return rows[0] === undefined
            ? null
            : mapEmailNotificationRow(asMysqlRow(rows[0]))
    }

    async findPending(limit: number): Promise<readonly EmailNotification[]> {
        requireNonNegativeLimit(limit)

        if (limit === 0) {
            return []
        }

        // MySQL does not reliably bind LIMIT placeholders in prepared statements.
        // The value is validated as a non-negative integer before interpolation.
        const rows = await executeRows<EmailNotificationRow>(
            this.executor,
            `
                SELECT
                    notification_id, parent_id, student_id, summary_id, recipient_email,
                    subject, body, sent_at, sent
                FROM email_notifications
                WHERE sent = FALSE
                ORDER BY created_at ASC, notification_id ASC
                LIMIT ${limit}
            `,
        )

        return rows.map((row) => mapEmailNotificationRow(asMysqlRow(row)))
    }

    async save(notification: EmailNotification): Promise<void> {
        await executeStatement(
            this.executor,
            `
                INSERT INTO email_notifications
                    (
                        notification_id, parent_id, student_id, summary_id,
                        recipient_email, subject, body, sent_at, sent
                    )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    parent_id = VALUES(parent_id),
                    student_id = VALUES(student_id),
                    summary_id = VALUES(summary_id),
                    recipient_email = VALUES(recipient_email),
                    subject = VALUES(subject),
                    body = VALUES(body),
                    sent_at = VALUES(sent_at),
                    sent = VALUES(sent)
            `,
            [
                notification.notificationId,
                notification.parentId,
                notification.studentId,
                notification.summaryId,
                notification.recipientEmail.value,
                notification.subject,
                notification.body,
                notification.sentAt,
                notification.sent,
            ],
        )
    }
}

function requireNonNegativeLimit(limit: number): void {
    if (!Number.isInteger(limit) || limit < 0) {
        throw new RangeError('limit must be a non-negative integer.')
    }
}
