import type { ProgressRecord } from '../../../domain/entities/progress-record.js'

export interface ProgressRecordRepository {
    /** Returns records ordered by assessment date, oldest first. */
    findByStudentId(studentId: string): Promise<readonly ProgressRecord[]>
    save(record: ProgressRecord): Promise<void>
    saveMany(records: readonly ProgressRecord[]): Promise<void>
}
