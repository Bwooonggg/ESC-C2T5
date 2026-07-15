import { database } from '../repositories/database.js'
import type { ProgressRecord, Summary } from '../types/domain.js'

// `SummaryGeneratorService` from the PM2 sequence diagrams.
//
// Canned strings for now. When the real LLM lands (prompt design is Le Bin's
// per PM2), this is the file that changes — nothing upstream of the adapter
// knows or cares how the text is produced.

export function generate(records: ProgressRecord[]): Summary {
  const studentId = records[0]?.studentId ?? 'unknown'
  const existing = database.getLatestSummary(studentId)

  return {
    summaryId: existing?.summaryId ?? `sum-${studentId}`,
    studentId,
    content: existing?.content ?? 'No summary is available for this student yet.',
    generatedAt: new Date().toISOString(),
  }
}
