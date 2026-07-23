export interface AuditEvent {
    readonly eventId: string
    /** Opaque platform identity subject; not a DAS7 user-table foreign key. */
    readonly actorSubject: string | null
    readonly action: string
    readonly entityType: string
    readonly entityId: string
    readonly occurredAt: Date
    readonly metadata: Readonly<Record<string, unknown>>
}

export interface AuditRepository {
    record(event: AuditEvent): Promise<void>
}
