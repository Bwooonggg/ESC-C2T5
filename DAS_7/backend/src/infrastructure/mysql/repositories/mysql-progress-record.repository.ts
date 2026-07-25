import type { RowDataPacket } from 'mysql2/promise'
import type { ProgressRecord } from '../../../domain/entities/progress-record.js'
import type { ProgressRecordRepository } from '../../../modules/summaries/ports/progress-record.repository.js'
import { mapProgressRecordRow } from '../mappers/index.js'
import {
    asMysqlRow,
    executeRows,
    executeStatement,
    type MySqlExecutor,
} from './mysql-repository.js'

interface ProgressRecordRow extends RowDataPacket {}

export class MySqlProgressRecordRepository
    implements ProgressRecordRepository
{
    constructor(private readonly executor: MySqlExecutor) {}

    async findByStudentId(
        studentId: string,
    ): Promise<readonly ProgressRecord[]> {
        const rows = await executeRows<ProgressRecordRow>(
            this.executor,
            `
                SELECT
                    record_id, student_id, assessment_date, skill_area,
                    score, notes
                FROM progress_records
                WHERE student_id = ?
                ORDER BY assessment_date ASC, record_id ASC
            `,
            [studentId],
        )

        return rows.map((row) => mapProgressRecordRow(asMysqlRow(row)))
    }

    async save(record: ProgressRecord): Promise<void> {
        await executeStatement(
            this.executor,
            `
                INSERT INTO progress_records
                    (record_id, student_id, assessment_date, skill_area, score, notes)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    student_id = VALUES(student_id),
                    assessment_date = VALUES(assessment_date),
                    skill_area = VALUES(skill_area),
                    score = VALUES(score),
                    notes = VALUES(notes)
            `,
            [
                record.recordId,
                record.studentId,
                record.date,
                record.skillArea.value,
                record.score,
                record.notes,
            ],
        )
    }

    async saveMany(records: readonly ProgressRecord[]): Promise<void> {
        if (records.length === 0) {
            return
        }

        const placeholders = records.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
        const values = records.flatMap((record) => [
            record.recordId,
            record.studentId,
            record.date,
            record.skillArea.value,
            record.score,
            record.notes,
        ])

        await executeStatement(
            this.executor,
            `
                INSERT INTO progress_records
                    (record_id, student_id, assessment_date, skill_area, score, notes)
                VALUES ${placeholders}
                ON DUPLICATE KEY UPDATE
                    student_id = VALUES(student_id),
                    assessment_date = VALUES(assessment_date),
                    skill_area = VALUES(skill_area),
                    score = VALUES(score),
                    notes = VALUES(notes)
            `,
            values,
        )
    }
}
