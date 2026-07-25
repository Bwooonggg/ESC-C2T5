import type { Summary } from '../../../domain/entities/summary.js'

export interface SummaryRepository {
    findLatestByStudentId(studentId: string): Promise<Summary | null>
    findHistoryByStudentId(studentId: string): Promise<readonly Summary[]>
    save(summary: Summary): Promise<void>
}
