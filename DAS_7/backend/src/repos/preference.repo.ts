import type { SupabaseClient } from '@supabase/supabase-js';
import type { PreferenceRepo } from '../deps.js';
import type { NotificationPreference } from '../types.js';
import { rowToPreference, type NotificationPreferenceRow } from './mappers.js';

export function createPreferenceRepo(client: SupabaseClient): PreferenceRepo {
    return {
        /** Get Parent's preferences */
        async byParentId(parentId: string): Promise<NotificationPreference | null> {
            const { data, error } = await client
                .from('notification_preferences')
                .select('*')
                .eq('parent_id', parentId)
                .maybeSingle();
            if (error) throw new Error(`db: ${error.message}`);
            return data === null ? null : rowToPreference(data as NotificationPreferenceRow);
        },

        /** parent_id is the primary key, so one row per parent is created or replaced. */
        async upsert(pref: NotificationPreference): Promise<NotificationPreference> {
            const { data, error } = await client
                .from('notification_preferences')
                .upsert({
                    parent_id: pref.parentId,
                    enabled: pref.enabled,
                    frequency: pref.frequency,
                    recipient_email: pref.recipientEmail,
                }, { onConflict: 'parent_id' })
                .select() // return the saved row
                .single(); // expects exactly one row, returns obj instead of arr
            if (error) throw new Error(`db: ${error.message}`);
            return rowToPreference(data as NotificationPreferenceRow);
        },

        /** The scheduler's candidate set: every parent who opted in. */
        async listEnabled(): Promise<NotificationPreference[]> {
            const { data, error } = await client
                .from('notification_preferences')
                .select('*')
                .eq('enabled', true);
            if (error) throw new Error(`db: ${error.message}`);
            return (data ?? []).map((row: NotificationPreferenceRow) => rowToPreference(row));
        },
    };
}
