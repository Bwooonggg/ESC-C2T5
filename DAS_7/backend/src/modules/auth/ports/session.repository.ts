export interface SessionRecord {
    readonly sessionId: string
    readonly userId: string
    readonly tokenHash: string
    readonly expiresAt: Date
    readonly revokedAt: Date | null
}

export interface SessionRepository {
    findActiveByTokenHash(
        tokenHash: string,
        now: Date,
    ): Promise<SessionRecord | null>
    save(session: SessionRecord): Promise<void>
    revoke(sessionId: string, revokedAt: Date): Promise<void>
}
