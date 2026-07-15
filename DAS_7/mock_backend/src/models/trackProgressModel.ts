import { database } from '../repositories/database.js'
import type { ProgressRecord, Summary } from '../types/domain.js'

// `TrackProgressModel` from the Track Child's Progress sequence diagram.

export function getProgress(studentId: string): ProgressRecord[] {
  return database.getProgressRecords(studentId)
}

export function getLatestSummary(studentId: string): Summary | undefined {
  return database.getLatestSummary(studentId)
}
