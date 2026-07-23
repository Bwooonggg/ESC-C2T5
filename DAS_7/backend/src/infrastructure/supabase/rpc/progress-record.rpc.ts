import { z } from 'zod'
import type { InsightSupabaseClient } from '../clients/supabase-client.js'
import { parseInsightRow } from '../mappers/row-schemas.js'
import { toPostgresDate } from '../mappers/date-conversions.js'
import { runSupabase } from '../repositories/repository-support.js'

export interface ProgressRecordRpcInput {
    readonly scope: string
    readonly operation: string
    readonly idempotencyKey: string
    readonly requestHash: string
    readonly expiresAt: Date
    readonly eventId: string
    readonly recordId: string
    readonly studentId: string
    readonly assessmentDate: Date
    readonly skillArea: string
    readonly score: number
    readonly notes: string
    readonly sourceSystem: string
    readonly sourceRecordId: string
    readonly sourceRevision: number
    readonly actorSubject: string | null
}

export interface CorrectProgressRecordRpcInput extends ProgressRecordRpcInput {
    readonly supersedesRecordId: string
    readonly correctionReason: string
}

export interface ProgressRecordRpcResult {
    readonly recordId: string
    readonly studentId: string
    readonly progressVersion: number
}

const resultSchema = z.object({
    record_id: z.string().uuid(),
    student_id: z.string().uuid(),
    progress_version: z.number().int().positive(),
})

export class ProgressRecordRpc {
    constructor(private readonly client: InsightSupabaseClient) {}

    async insert(
        input: ProgressRecordRpcInput,
    ): Promise<ProgressRecordRpcResult> {
        const data = await runSupabase(
            'supabase.rpc.insert_progress_record',
            () =>
                this.client.rpc('insert_progress_record', {
                    p_scope: input.scope,
                    p_operation: input.operation,
                    p_idempotency_key: input.idempotencyKey,
                    p_request_hash: input.requestHash,
                    p_expires_at: input.expiresAt.toISOString(),
                    p_event_id: input.eventId,
                    p_record_id: input.recordId,
                    p_student_id: input.studentId,
                    p_assessment_date: toPostgresDate(input.assessmentDate),
                    p_skill_area: input.skillArea,
                    p_score: input.score,
                    p_notes: input.notes,
                    p_source_system: input.sourceSystem,
                    p_source_record_id: input.sourceRecordId,
                    p_source_revision: input.sourceRevision,
                    p_actor_subject: nullableRpcArgument(input.actorSubject),
                }),
        )

        return mapResult(data)
    }

    async correct(
        input: CorrectProgressRecordRpcInput,
    ): Promise<ProgressRecordRpcResult> {
        const data = await runSupabase(
            'supabase.rpc.correct_progress_record',
            () =>
                this.client.rpc('correct_progress_record', {
                    p_scope: input.scope,
                    p_operation: input.operation,
                    p_idempotency_key: input.idempotencyKey,
                    p_request_hash: input.requestHash,
                    p_expires_at: input.expiresAt.toISOString(),
                    p_event_id: input.eventId,
                    p_record_id: input.recordId,
                    p_student_id: input.studentId,
                    p_assessment_date: toPostgresDate(input.assessmentDate),
                    p_skill_area: input.skillArea,
                    p_score: input.score,
                    p_notes: input.notes,
                    p_source_system: input.sourceSystem,
                    p_source_record_id: input.sourceRecordId,
                    p_source_revision: input.sourceRevision,
                    p_supersedes_record_id: input.supersedesRecordId,
                    p_correction_reason: input.correctionReason,
                    p_actor_subject: nullableRpcArgument(input.actorSubject),
                }),
        )

        return mapResult(data)
    }
}

function mapResult(value: unknown): ProgressRecordRpcResult {
    const parsed = parseInsightRow(
        resultSchema,
        value,
        'progress_record_rpc_result',
    )

    return {
        recordId: parsed.record_id,
        studentId: parsed.student_id,
        progressVersion: parsed.progress_version,
    }
}

/** Generated Supabase types currently model nullable RPC arguments as strings. */
function nullableRpcArgument(value: string | null): string {
    return value as unknown as string
}
