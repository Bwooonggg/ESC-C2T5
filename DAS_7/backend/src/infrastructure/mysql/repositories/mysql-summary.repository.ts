import type { RowDataPacket } from 'mysql2/promise'
import type { Summary } from '../../../domain/entities/summary.js'
import type { SummaryRepository } from '../../../modules/summaries/ports/summary.repository.js'
import { mapSummaryRow } from '../mappers/index.js'
import {
    asMysqlRow,
    executeRows,
    executeStatement,
    type MySqlExecutor,
} from './mysql-repository.js'

interface SummaryRow extends RowDataPacket {}

export class MySqlSummaryRepository implements SummaryRepository {
    constructor(private readonly executor: MySqlExecutor) {}

    async findLatestByStudentId(studentId: string): Promise<Summary | null> {
        const rows = await executeRows<SummaryRow>(
            this.executor,
            `
                SELECT
                    summary_id, student_id, content, generated_at,
                    source_progress_version
                FROM summaries
                WHERE student_id = ?
                ORDER BY generated_at DESC, summary_id DESC
                LIMIT 1
            `,
            [studentId],
        )

        return rows[0] === undefined
            ? null
            : mapSummaryRow(asMysqlRow(rows[0]))
    }

    async findHistoryByStudentId(
        studentId: string,
    ): Promise<readonly Summary[]> {
        const rows = await executeRows<SummaryRow>(
            this.executor,
            `
                SELECT
                    summary_id, student_id, content, generated_at,
                    source_progress_version
                FROM summaries
                WHERE student_id = ?
                ORDER BY generated_at DESC, summary_id DESC
            `,
            [studentId],
        )

        return rows.map((row) => mapSummaryRow(asMysqlRow(row)))
    }

    async save(summary: Summary): Promise<void> {
        await executeStatement(
            this.executor,
            `
                INSERT INTO summaries
                    (summary_id, student_id, content, generated_at, source_progress_version)
                VALUES (?, ?, ?, ?, ?)
            `,
            [
                summary.summaryId,
                summary.studentId,
                summary.content,
                summary.generatedAt,
                summary.sourceProgressVersion,
            ],
        )
    }
}
