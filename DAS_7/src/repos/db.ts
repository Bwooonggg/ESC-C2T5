import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppConfig } from '../config.js';

/**
 * Service-role client scoped to the DAS 7 schema. RLS is bypassed, so every
 * authorization check happens in backend code, never in the database.
 */
export function createDbClient(config: AppConfig): SupabaseClient {
    return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        // The schema name is configuration, so it is a plain `string` here while
        // SupabaseClient's default schema parameter is the literal 'public'. That
        // parameter only types relation names against a generated Database type,
        // which this untyped client does not use, so the cast costs no safety.
        db: { schema: config.supabaseDbSchema as 'public' },
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
