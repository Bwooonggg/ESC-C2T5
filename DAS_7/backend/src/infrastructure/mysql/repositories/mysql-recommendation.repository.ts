import type { RowDataPacket } from 'mysql2/promise'
import type { Recommendation } from '../../../domain/entities/recommendation.js'
import type { RecommendationRepository } from '../../../modules/track-progress/ports/recommendation.repository.js'
import { mapRecommendationRow } from '../mappers/index.js'
import {
    asMysqlRow,
    executeRows,
    executeStatement,
    type MySqlExecutor,
} from './mysql-repository.js'

interface RecommendationRow extends RowDataPacket {}

export class MySqlRecommendationRepository
    implements RecommendationRepository
{
    constructor(private readonly executor: MySqlExecutor) {}

    async findByStudentId(
        studentId: string,
    ): Promise<readonly Recommendation[]> {
        const rows = await executeRows<RecommendationRow>(
            this.executor,
            `
                SELECT
                    recommendation_id, student_id, summary_id, content,
                    generated_at
                FROM recommendations
                WHERE student_id = ?
                ORDER BY generated_at DESC, recommendation_id DESC
            `,
            [studentId],
        )

        return rows.map((row) => mapRecommendationRow(asMysqlRow(row)))
    }

    async findBySummaryId(
        summaryId: string,
    ): Promise<readonly Recommendation[]> {
        const rows = await executeRows<RecommendationRow>(
            this.executor,
            `
                SELECT
                    recommendation_id, student_id, summary_id, content,
                    generated_at
                FROM recommendations
                WHERE summary_id = ?
                ORDER BY generated_at DESC, recommendation_id DESC
            `,
            [summaryId],
        )

        return rows.map((row) => mapRecommendationRow(asMysqlRow(row)))
    }

    async save(recommendation: Recommendation): Promise<void> {
        await executeStatement(
            this.executor,
            `
                INSERT INTO recommendations
                    (recommendation_id, student_id, summary_id, content, generated_at)
                VALUES (?, ?, ?, ?, ?)
            `,
            [
                recommendation.recommendationId,
                recommendation.studentId,
                recommendation.summaryId,
                recommendation.content,
                recommendation.generatedAt,
            ],
        )
    }
}
