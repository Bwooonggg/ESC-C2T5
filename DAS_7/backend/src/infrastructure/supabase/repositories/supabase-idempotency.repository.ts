import type {
    IdempotencyKey,
    IdempotencyRecord,
    IdempotencyRecordInput,
    IdempotencyRepository,
} from '../../../modules/ingestion/ports/idempotency.repository.js'
import type { InsightSupabaseClient } from '../clients/supabase-client.js'
import {
    mapIdempotencyInputToInsert,
    mapIdempotencyRecordRow,
    mapIdempotencyTerminalToUpdate,
} from '../mappers/index.js'
import {
    idempotencyRecordRowSchema,
    parseInsightRow,
} from '../mappers/row-schemas.js'
import { runSupabase } from './repository-support.js'

export class SupabaseIdempotencyRepository implements IdempotencyRepository {
    constructor(private readonly client: InsightSupabaseClient) {}

    async find(key: IdempotencyKey): Promise<IdempotencyRecord | null> {
        const rows = await runSupabase(
            'supabase.idempotency_records.find',
            () =>
                this.client
                    .from('idempotency_records')
                    .select('*')
                    .eq('scope', key.scope)
                    .eq('operation', key.operation)
                    .eq('idempotency_key', key.idempotencyKey)
                    .limit(1),
        )

        const row = rows[0]
        return row === undefined
            ? null
            : mapIdempotencyRecordRow(
                  parseInsightRow(
                      idempotencyRecordRowSchema,
                      row,
                      'idempotency_records',
                  ),
              )
    }

    async createProcessing(record: IdempotencyRecordInput): Promise<void> {
        await runSupabase(
            'supabase.idempotency_records.createProcessing',
            () =>
                this.client
                    .from('idempotency_records')
                    .insert(mapIdempotencyInputToInsert(record)),
        )
    }

    async markCompleted(
        key: IdempotencyKey,
        responseStatus: number,
        responseBody: Readonly<Record<string, unknown>> | null,
        completedAt: Date,
    ): Promise<void> {
        await this.updateTerminalState(
            'completed',
            key,
            responseStatus,
            responseBody,
            completedAt,
        )
    }

    async markFailed(
        key: IdempotencyKey,
        responseStatus: number,
        responseBody: Readonly<Record<string, unknown>> | null,
        failedAt: Date,
    ): Promise<void> {
        await this.updateTerminalState(
            'failed',
            key,
            responseStatus,
            responseBody,
            failedAt,
        )
    }

    private async updateTerminalState(
        status: 'completed' | 'failed',
        key: IdempotencyKey,
        responseStatus: number,
        responseBody: Readonly<Record<string, unknown>> | null,
        timestamp: Date,
    ): Promise<void> {
        const update = mapIdempotencyTerminalToUpdate(
            status,
            responseStatus,
            responseBody,
            timestamp,
        )

        await runSupabase(
            `supabase.idempotency_records.mark${
                status[0].toUpperCase() + status.slice(1)
            }`,
            () =>
                this.client
                    .from('idempotency_records')
                    .update(update)
                    .eq('scope', key.scope)
                    .eq('operation', key.operation)
                    .eq('idempotency_key', key.idempotencyKey)
                    .eq('status', 'processing')
                    .select('*')
                    .single(),
        )
    }
}
