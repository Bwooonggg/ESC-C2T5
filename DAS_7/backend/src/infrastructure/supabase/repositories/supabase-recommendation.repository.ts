import type { Recommendation } from '../../../domain/entities/recommendation.js'
import type { RecommendationRepository } from '../../../modules/track-progress/ports/recommendation.repository.js'
import type { InsightSupabaseClient } from '../clients/supabase-client.js'
import {
    mapRecommendationRow,
    mapRecommendationToInsert,
} from '../mappers/index.js'
import {
    parseInsightRow,
    recommendationRowSchema,
    type RecommendationRow,
} from '../mappers/row-schemas.js'
import { runSupabase } from './repository-support.js'

export class SupabaseRecommendationRepository
    implements RecommendationRepository
{
    constructor(private readonly client: InsightSupabaseClient) {}

    async findByStudentId(
        studentId: string,
    ): Promise<readonly Recommendation[]> {
        const rows = await runSupabase(
            'supabase.recommendations.findByStudentId',
            () =>
                this.client
                    .from('recommendations')
                    .select('*')
                    .eq('student_id', studentId)
                    .order('generated_at', { ascending: false })
                    .order('recommendation_id', { ascending: false }),
        )

        return rows.map((row) =>
            mapRecommendationRow(
                parseInsightRow(
                    recommendationRowSchema,
                    row,
                    'recommendations',
                ) as RecommendationRow,
            ),
        )
    }

    async findBySummaryId(
        summaryId: string,
    ): Promise<readonly Recommendation[]> {
        const rows = await runSupabase(
            'supabase.recommendations.findBySummaryId',
            () =>
                this.client
                    .from('recommendations')
                    .select('*')
                    .eq('summary_id', summaryId)
                    .order('generated_at', { ascending: false })
                    .order('recommendation_id', { ascending: false }),
        )

        return rows.map((row) =>
            mapRecommendationRow(
                parseInsightRow(
                    recommendationRowSchema,
                    row,
                    'recommendations',
                ) as RecommendationRow,
            ),
        )
    }

    async save(recommendation: Recommendation): Promise<void> {
        await runSupabase(
            'supabase.recommendations.save',
            () =>
                this.client
                    .from('recommendations')
                    .insert(mapRecommendationToInsert(recommendation)),
        )
    }
}
