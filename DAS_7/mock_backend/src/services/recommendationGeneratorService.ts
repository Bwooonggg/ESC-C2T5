import { seedRecommendationText } from '../repositories/database.js'
import type { Recommendation, Summary } from '../types/domain.js'

// `RecommendationGeneratorService` from the PM2 sequence diagrams.
// Canned, same as the summary generator — see the note there.

export function generate(summary: Summary): Recommendation {
  return {
    recommendationId: `rec-${summary.studentId}`,
    summaryId: summary.summaryId,
    content:
      seedRecommendationText[summary.studentId] ??
      'No recommendations are available for this student yet.',
    generatedAt: new Date().toISOString(),
  }
}
