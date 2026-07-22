import type { RowDataPacket } from 'mysql2/promise'
import type { NotificationPreference } from '../../../domain/entities/notification-preference.js'
import type { NotificationPreferenceRepository } from '../../../modules/preferences/ports/notification-preference.repository.js'
import { mapNotificationPreferenceRow } from '../mappers/index.js'
import {
    asMysqlRow,
    executeRows,
    executeStatement,
    type MySqlExecutor,
} from './mysql-repository.js'

interface NotificationPreferenceRow extends RowDataPacket {}

export class MySqlNotificationPreferenceRepository
    implements NotificationPreferenceRepository
{
    constructor(private readonly executor: MySqlExecutor) {}

    async findByParentId(
        parentId: string,
    ): Promise<NotificationPreference | null> {
        const rows = await executeRows<NotificationPreferenceRow>(
            this.executor,
            `
                SELECT parent_id, enabled, frequency, recipient_email
                FROM notification_preferences
                WHERE parent_id = ?
                LIMIT 1
            `,
            [parentId],
        )

        return rows[0] === undefined
            ? null
            : mapNotificationPreferenceRow(asMysqlRow(rows[0]))
    }

    async listEnabled(): Promise<readonly NotificationPreference[]> {
        const rows = await executeRows<NotificationPreferenceRow>(
            this.executor,
            `
                SELECT parent_id, enabled, frequency, recipient_email
                FROM notification_preferences
                WHERE enabled = TRUE
                ORDER BY frequency ASC, parent_id ASC
            `,
        )

        return rows.map((row) =>
            mapNotificationPreferenceRow(asMysqlRow(row)),
        )
    }

    async save(preference: NotificationPreference): Promise<void> {
        await executeStatement(
            this.executor,
            `
                INSERT INTO notification_preferences
                    (parent_id, enabled, frequency, recipient_email)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    enabled = VALUES(enabled),
                    frequency = VALUES(frequency),
                    recipient_email = VALUES(recipient_email)
            `,
            [
                preference.parentId,
                preference.enabled,
                preference.frequency.value,
                preference.recipientEmail.value,
            ],
        )
    }
}
