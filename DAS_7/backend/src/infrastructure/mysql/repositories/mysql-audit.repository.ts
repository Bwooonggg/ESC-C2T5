import type { AuditEvent, AuditRepository } from '../../../modules/ingestion/ports/audit.repository.js'
import {
    executeStatement,
    type MySqlExecutor,
} from './mysql-repository.js'

export class MySqlAuditRepository implements AuditRepository {
    constructor(private readonly executor: MySqlExecutor) {}

    async record(event: AuditEvent): Promise<void> {
        await executeStatement(
            this.executor,
            `
                INSERT INTO audit_events
                    (
                        event_id, actor_user_id, action, entity_type,
                        entity_id, occurred_at, metadata
                    )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                event.eventId,
                event.actorUserId,
                event.action,
                event.entityType,
                event.entityId,
                event.occurredAt,
                JSON.stringify(event.metadata),
            ],
        )
    }
}
