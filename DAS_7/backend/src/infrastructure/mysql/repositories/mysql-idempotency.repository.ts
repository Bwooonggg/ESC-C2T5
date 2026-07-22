import type { RowDataPacket } from 'mysql2/promise'
import type {
    IdempotencyKey,
    IdempotencyRecord,
    IdempotencyRecordInput,
    IdempotencyRepository,
} from '../../../modules/ingestion/ports/idempotency.repository.js'
import { mapIdempotencyRecordRow } from '../mappers/index.js'
import {
    asMysqlRow,
    executeRows,
    executeStatement,
    type MySqlExecutor,
} from './mysql-repository.js'

interface IdempotencyRecordRow extends RowDataPacket {}

const idempotencyColumns = `
    scope, operation, idempotency_key, request_hash, status,
    response_status, response_body, expires_at, completed_at, failed_at,
    created_at
`

export class MySqlIdempotencyRepository implements IdempotencyRepository {
    constructor(private readonly executor: MySqlExecutor) {}

    async find(key: IdempotencyKey): Promise<IdempotencyRecord | null> {
        const rows = await executeRows<IdempotencyRecordRow>(
            this.executor,
            `
                SELECT ${idempotencyColumns}
                FROM idempotency_records
                WHERE scope = ?
                    AND operation = ?
                    AND idempotency_key = ?
                LIMIT 1
            `,
            [key.scope, key.operation, key.idempotencyKey],
        )

        return rows[0] === undefined
            ? null
            : mapIdempotencyRecordRow(asMysqlRow(rows[0]))
    }

    async createProcessing(record: IdempotencyRecordInput): Promise<void> {
        await executeStatement(
            this.executor,
            `
                INSERT INTO idempotency_records
                    (
                        scope, operation, idempotency_key, request_hash,
                        status, response_status, response_body, expires_at
                    )
                VALUES (?, ?, ?, ?, 'processing', NULL, NULL, ?)
            `,
            [
                record.scope,
                record.operation,
                record.idempotencyKey,
                record.requestHash,
                record.expiresAt,
            ],
        )
    }

    async markCompleted(
        key: IdempotencyKey,
        responseStatus: number,
        responseBody: Readonly<Record<string, unknown>> | null,
        completedAt: Date,
    ): Promise<void> {
        await executeStatement(
            this.executor,
            `
                UPDATE idempotency_records
                SET
                    status = 'completed',
                    response_status = ?,
                    response_body = ?,
                    completed_at = ?,
                    failed_at = NULL
                WHERE scope = ?
                    AND operation = ?
                    AND idempotency_key = ?
                    AND status = 'processing'
            `,
            [
                responseStatus,
                serializeResponseBody(responseBody),
                completedAt,
                key.scope,
                key.operation,
                key.idempotencyKey,
            ],
        )
    }

    async markFailed(
        key: IdempotencyKey,
        responseStatus: number,
        responseBody: Readonly<Record<string, unknown>> | null,
        failedAt: Date,
    ): Promise<void> {
        await executeStatement(
            this.executor,
            `
                UPDATE idempotency_records
                SET
                    status = 'failed',
                    response_status = ?,
                    response_body = ?,
                    completed_at = NULL,
                    failed_at = ?
                WHERE scope = ?
                    AND operation = ?
                    AND idempotency_key = ?
                    AND status = 'processing'
            `,
            [
                responseStatus,
                serializeResponseBody(responseBody),
                failedAt,
                key.scope,
                key.operation,
                key.idempotencyKey,
            ],
        )
    }
}

function serializeResponseBody(
    responseBody: Readonly<Record<string, unknown>> | null,
): string | null {
    return responseBody === null ? null : JSON.stringify(responseBody)
}
