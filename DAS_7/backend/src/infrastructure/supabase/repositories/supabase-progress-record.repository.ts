import { createHash, randomUUID } from 'node:crypto'
import type { ProgressRecord } from '../../../domain/entities/progress-record.js'
import type { ProgressRecordRepository } from '../../../modules/summaries/ports/progress-record.repository.js'
import type { InsightSupabaseClient } from '../clients/supabase-client.js'
import { mapProgressRecordRow } from '../mappers/domain-mappers.js'
import {
    parseInsightRow,
    progressRecordRowSchema,
} from '../mappers/row-schemas.js'
import { ProgressRecordRpc } from '../rpc/progress-record.rpc.js'
import { runSupabase } from './repository-support.js'

export interface SupabaseProgressRecordRepositoryOptions {
    readonly sourceSystem?: string
    readonly actorSubject?: string | null
    readonly idempotencyTtlMs?: number
    readonly now?: () => Date
}

export class SupabaseProgressRecordRepository
    implements ProgressRecordRepository
{
    private readonly rpc: ProgressRecordRpc
    private readonly sourceSystem: string
    private readonly actorSubject: string | null
    private readonly idempotencyTtlMs: number
    private readonly now: () => Date

    constructor(
        private readonly client: InsightSupabaseClient,
        options: SupabaseProgressRecordRepositoryOptions = {},
    ) {
        this.rpc = new ProgressRecordRpc(client)
        const sourceSystem = options.sourceSystem ?? 'das7'

        if (sourceSystem.trim() === '') {
            throw new TypeError('sourceSystem is required.')
        }

        this.sourceSystem = sourceSystem.trim()
        this.actorSubject = options.actorSubject ?? null
        this.idempotencyTtlMs = options.idempotencyTtlMs ?? 60 * 60 * 1000

        if (
            !Number.isInteger(this.idempotencyTtlMs) ||
            this.idempotencyTtlMs < 1
        ) {
            throw new RangeError('idempotencyTtlMs must be a positive integer.')
        }

        this.now = options.now ?? (() => new Date())
    }

    async findByStudentId(
        studentId: string,
    ): Promise<readonly ProgressRecord[]> {
        const rows = await runSupabase(
            'supabase.progress_records.findByStudentId',
            () =>
                this.client
                    .from('progress_records')
                    .select('*')
                    .eq('student_id', studentId)
                    .order('assessment_date', { ascending: true })
                    .order('record_id', { ascending: true }),
        )

        return rows.map((row) =>
            mapProgressRecordRow(
                parseInsightRow(
                    progressRecordRowSchema,
                    row,
                    'progress_records',
                ),
            ),
        )
    }

    async save(record: ProgressRecord): Promise<void> {
        const now = this.now()
        const requestHash = hashRecord(
            record,
            this.sourceSystem,
            this.actorSubject,
        )

        await this.rpc.insert({
            scope: `student:${record.studentId}`,
            operation: 'progress-record.insert',
            idempotencyKey: record.recordId,
            requestHash,
            expiresAt: new Date(now.getTime() + this.idempotencyTtlMs),
            eventId: randomUUID(),
            recordId: record.recordId,
            studentId: record.studentId,
            assessmentDate: record.date,
            skillArea: record.skillArea.value,
            score: record.score,
            notes: record.notes,
            sourceSystem: this.sourceSystem,
            sourceRecordId: record.recordId,
            sourceRevision: 1,
            actorSubject: this.actorSubject,
        })
    }

    async saveMany(records: readonly ProgressRecord[]): Promise<void> {
        for (const record of records) {
            await this.save(record)
        }
    }
}

function hashRecord(
    record: ProgressRecord,
    sourceSystem: string,
    actorSubject: string | null,
): string {
    return createHash('sha256')
        .update(
            JSON.stringify({
                recordId: record.recordId,
                studentId: record.studentId,
                date: record.date.toISOString(),
                skillArea: record.skillArea.value,
                score: record.score,
                notes: record.notes,
                sourceSystem,
                actorSubject,
            }),
        )
        .digest('hex')
}
