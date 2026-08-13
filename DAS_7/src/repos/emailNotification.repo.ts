import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmailNotificationRepo } from '../deps.js';

export function createEmailNotificationRepo(client: SupabaseClient): EmailNotificationRepo {
    return {
        /** Drives the scheduler's "is another email due yet?" check. */
        async lastSentAt(parentId: string): Promise<string | null> {
            const { data, error } = await client
                .from('email_notifications')
                .select('sent_at')
                .eq('parent_id', parentId)
                .order('sent_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) throw new Error(`db: ${error.message}`);
            return data === null ? null : (data as { sent_at: string }).sent_at;
        },

        async insert(input: {
            parentId: string;
            summaryId: string | null;
            recipientEmail: string;
            subject: string;
            body: string;
        }): Promise<void> {
            const { error } = await client
                .from('email_notifications')
                .insert({
                    parent_id: input.parentId,
                    summary_id: input.summaryId,
                    recipient_email: input.recipientEmail,
                    subject: input.subject,
                    body: input.body,
                });
            if (error) throw new Error(`db: ${error.message}`);
        },
    };
}
