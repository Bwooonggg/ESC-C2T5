export interface AuditEvent {
    readonly eventId: string
    readonly actorUserId: string | null
    readonly action: string
    readonly entityType: string
    readonly entityId: string
    readonly occurredAt: Date
    readonly metadata: Readonly<Record<string, unknown>>
}

export interface AuditRepository {
    record(event: AuditEvent): Promise<void>
}
