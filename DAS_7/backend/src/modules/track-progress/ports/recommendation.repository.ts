import type { Recommendation } from '../../../domain/entities/recommendation.js'

export interface RecommendationRepository {
    findByStudentId(studentId: string): Promise<readonly Recommendation[]>
    findBySummaryId(summaryId: string): Promise<readonly Recommendation[]>
    save(recommendation: Recommendation): Promise<void>
}
