import * as recommendationGeneratorService from '../services/recommendationGeneratorService.js'
import * as summaryGeneratorService from '../services/summaryGeneratorService.js'
import type { ProgressRecord, Recommendation, Summary } from '../types/domain.js'
import { delay } from '../utils/delay.js'

// `GeneratorServiceAdapter` from the PM2 sequence diagrams.
//
// Naming note (plan gap 3.3): the Track Child's Progress diagram calls this
// `GeneratorAdapter` while Notify Parent calls it `GeneratorServiceAdapter`.
// Same object. Standardised on `GeneratorServiceAdapter` here because it
// parallels `EmailServiceAdapter`; the Track Progress diagram needs fixing in
// the report to match.
//
// This adapter is the seam. Swapping canned text for a real LLM should touch
// the services behind it and nothing else.

export async function generateSummary(records: ProgressRecord[]): Promise<Summary> {
  await delay()
  return summaryGeneratorService.generate(records)
}

export async function generateRecommendation(summary: Summary): Promise<Recommendation> {
  await delay()
  return recommendationGeneratorService.generate(summary)
}
