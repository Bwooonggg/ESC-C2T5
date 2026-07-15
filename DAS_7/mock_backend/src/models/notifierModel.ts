import * as emailServiceAdapter from '../adapters/emailServiceAdapter.js'
import * as generatorServiceAdapter from '../adapters/generatorServiceAdapter.js'
import { database } from '../repositories/database.js'
import type { EmailNotification, Student } from '../types/domain.js'

// `NotifierModel` from the Notify Parent sequence diagram:
//   notifyParent(student) -> generateSummary(records) -> sendNotification(summary, recipient)

export async function notifyParent(
  student: Student,
  recipientEmail: string,
): Promise<EmailNotification | null> {
  const records = database.getProgressRecords(student.studentId)
  if (records.length === 0) return null

  const summary = await generatorServiceAdapter.generateSummary(records)
  return emailServiceAdapter.sendNotification(summary, recipientEmail)
}
