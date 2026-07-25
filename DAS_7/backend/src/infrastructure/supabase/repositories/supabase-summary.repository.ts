import type { Summary } from '../../../domain/entities/summary.js'
import type { SummaryRepository } from '../../../modules/summaries/ports/summary.repository.js'
import type { InsightSupabaseClient } from '../clients/supabase-client.js'
import {
    mapSummaryRow,
    mapSummaryToInsert,
} from '../mappers/index.js'
import {
    parseInsightRow,
    summaryRowSchema,
    type SummaryRow,
} from '../mappers/row-schemas.js'
import { runSupabase } from './repository-support.js'

export class SupabaseSummaryRepository implements SummaryRepository {
    constructor(private readonly client: InsightSupabaseClient) {}

    async findLatestByStudentId(studentId: string): Promise<Summary | null> {
        const rows = await runSupabase(
            'supabase.summaries.findLatestByStudentId',
            () =>
                this.client
                    .from('summaries')
                    .select('*')
                    .eq('student_id', studentId)
                    .order('generated_at', { ascending: false })
                    .order('summary_id', { ascending: false })
                    .limit(1),
        )

        const row = rows[0]
        return row === undefined
            ? null
            : mapSummaryRow(
                  parseInsightRow(
                      summaryRowSchema,
                      row,
                      'summaries',
                  ) as SummaryRow,
              )
    }

    async findHistoryByStudentId(
        studentId: string,
    ): Promise<readonly Summary[]> {
        const rows = await runSupabase(
            'supabase.summaries.findHistoryByStudentId',
            () =>
                this.client
                    .from('summaries')
                    .select('*')
                    .eq('student_id', studentId)
                    .order('generated_at', { ascending: false })
                    .order('summary_id', { ascending: false }),
        )

        return rows.map((row) =>
            mapSummaryRow(
                parseInsightRow(
                    summaryRowSchema,
                    row,
                    'summaries',
                ) as SummaryRow,
            ),
        )
    }

    async save(summary: Summary): Promise<void> {
        await runSupabase(
            'supabase.summaries.save',
            () =>
                this.client
                    .from('summaries')
                    .insert(mapSummaryToInsert(summary)),
        )
    }
}
