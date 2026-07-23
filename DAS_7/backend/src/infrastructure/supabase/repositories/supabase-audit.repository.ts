import type {
    AuditEvent,
    AuditRepository,
} from '../../../modules/ingestion/ports/audit.repository.js'
import type { InsightSupabaseClient } from '../clients/supabase-client.js'
import { mapAuditEventToInsert } from '../mappers/index.js'
import { runSupabase } from './repository-support.js'

export class SupabaseAuditRepository implements AuditRepository {
    constructor(private readonly client: InsightSupabaseClient) {}

    async record(event: AuditEvent): Promise<void> {
        await runSupabase(
            'supabase.audit_events.record',
            () =>
                this.client
                    .from('audit_events')
                    .insert(mapAuditEventToInsert(event)),
        )
    }
}
