import type { EmailNotification } from '../../../domain/entities/email-notification.js'
import type { EmailNotificationRepository } from '../../../modules/notifications/ports/email-notification.repository.js'
import type { InsightSupabaseClient } from '../clients/supabase-client.js'
import {
    mapEmailNotificationRow,
    mapEmailNotificationToInsert,
} from '../mappers/index.js'
import {
    emailNotificationRowSchema,
    parseInsightRow,
} from '../mappers/row-schemas.js'
import {
    requireNonNegativeLimit,
    runSupabase,
} from './repository-support.js'

export class SupabaseEmailNotificationRepository
    implements EmailNotificationRepository
{
    constructor(private readonly client: InsightSupabaseClient) {}

    async findById(
        notificationId: string,
    ): Promise<EmailNotification | null> {
        const rows = await runSupabase(
            'supabase.email_notifications.findById',
            () =>
                this.client
                    .from('email_notifications')
                    .select('*')
                    .eq('notification_id', notificationId)
                    .limit(1),
        )

        const row = rows[0]
        return row === undefined
            ? null
            : mapEmailNotificationRow(
                  parseInsightRow(
                      emailNotificationRowSchema,
                      row,
                      'email_notifications',
                  ),
              )
    }

    async findPending(limit: number): Promise<readonly EmailNotification[]> {
        requireNonNegativeLimit(limit)

        if (limit === 0) {
            return []
        }

        const rows = await runSupabase(
            'supabase.email_notifications.findPending',
            () =>
                this.client
                    .from('email_notifications')
                    .select('*')
                    .eq('sent', false)
                    .order('created_at', { ascending: true })
                    .order('notification_id', { ascending: true })
                    .limit(limit),
        )

        return rows.map((row) =>
            mapEmailNotificationRow(
                parseInsightRow(
                    emailNotificationRowSchema,
                    row,
                    'email_notifications',
                ),
            ),
        )
    }

    async save(notification: EmailNotification): Promise<void> {
        await runSupabase(
            'supabase.email_notifications.save',
            () =>
                this.client
                    .from('email_notifications')
                    .upsert(mapEmailNotificationToInsert(notification), {
                        onConflict: 'notification_id',
                    }),
        )
    }
}
