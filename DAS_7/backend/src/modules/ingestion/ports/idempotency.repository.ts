export type IdempotencyStatus = 'processing' | 'completed' | 'failed'

export interface IdempotencyKey {
    readonly scope: string
    readonly operation: string
    readonly idempotencyKey: string
}

export interface IdempotencyRecord extends IdempotencyKey {
    readonly requestHash: string
    readonly status: IdempotencyStatus
    readonly responseStatus: number | null
    readonly responseBody: Readonly<Record<string, unknown>> | null
    readonly expiresAt: Date
    readonly completedAt: Date | null
    readonly failedAt: Date | null
    readonly createdAt: Date
}

export interface IdempotencyRecordInput extends IdempotencyKey {
    readonly requestHash: string
    readonly expiresAt: Date
}

export interface IdempotencyRepository {
    find(key: IdempotencyKey): Promise<IdempotencyRecord | null>
    createProcessing(record: IdempotencyRecordInput): Promise<void>
    markCompleted(
        key: IdempotencyKey,
        responseStatus: number,
        responseBody: Readonly<Record<string, unknown>> | null,
        completedAt: Date,
    ): Promise<void>
    markFailed(
        key: IdempotencyKey,
        responseStatus: number,
        responseBody: Readonly<Record<string, unknown>> | null,
        failedAt: Date,
    ): Promise<void>
}
