import type { NotificationPreference } from '../../../domain/entities/notification-preference.js'
import type { NotificationPreferenceRepository } from '../../../modules/preferences/ports/notification-preference.repository.js'
import type { InsightSupabaseClient } from '../clients/supabase-client.js'
import {
    mapNotificationPreferenceRow,
    mapPreferenceToInsert,
} from '../mappers/index.js'
import {
    notificationPreferenceRowSchema,
    parseInsightRow,
} from '../mappers/row-schemas.js'
import { runSupabase } from './repository-support.js'

export class SupabaseNotificationPreferenceRepository
    implements NotificationPreferenceRepository
{
    constructor(private readonly client: InsightSupabaseClient) {}

    async findByParentId(
        parentId: string,
    ): Promise<NotificationPreference | null> {
        const rows = await runSupabase(
            'supabase.notification_preferences.findByParentId',
            () =>
                this.client
                    .from('notification_preferences')
                    .select('*')
                    .eq('parent_id', parentId)
                    .limit(1),
        )

        const row = rows[0]
        return row === undefined
            ? null
            : mapNotificationPreferenceRow(
                  parseInsightRow(
                      notificationPreferenceRowSchema,
                      row,
                      'notification_preferences',
                  ),
              )
    }

    async listEnabled(): Promise<readonly NotificationPreference[]> {
        const rows = await runSupabase(
            'supabase.notification_preferences.listEnabled',
            () =>
                this.client
                    .from('notification_preferences')
                    .select('*')
                    .eq('enabled', true)
                    .order('frequency', { ascending: true })
                    .order('parent_id', { ascending: true }),
        )

        return rows.map((row) =>
            mapNotificationPreferenceRow(
                parseInsightRow(
                    notificationPreferenceRowSchema,
                    row,
                    'notification_preferences',
                ),
            ),
        )
    }

    async save(preference: NotificationPreference): Promise<void> {
        await runSupabase(
            'supabase.notification_preferences.save',
            () =>
                this.client
                    .from('notification_preferences')
                    .upsert(mapPreferenceToInsert(preference), {
                        onConflict: 'parent_id',
                    }),
        )
    }
}
