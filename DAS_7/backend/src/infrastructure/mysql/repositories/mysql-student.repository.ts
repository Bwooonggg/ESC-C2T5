import type { Student } from '../../../domain/entities/student.js'
import type { StudentRepository } from '../../../modules/track-progress/ports/student.repository.js'
import type { RowDataPacket } from 'mysql2/promise'
import { mapStudentRow } from '../mappers/index.js'
import {
    asMysqlRow,
    executeRows,
    executeStatement,
    type MySqlExecutor,
} from './mysql-repository.js'

interface StudentRow extends RowDataPacket {}

export class MySqlStudentRepository implements StudentRepository {
    constructor(private readonly executor: MySqlExecutor) {}

    async findById(studentId: string): Promise<Student | null> {
        const rows = await executeRows<StudentRow>(
            this.executor,
            `
                SELECT
                    student_id, name, date_of_birth, band_level,
                    current_progress_version
                FROM students
                WHERE student_id = ?
                LIMIT 1
            `,
            [studentId],
        )

        return rows[0] === undefined
            ? null
            : mapStudentRow(asMysqlRow(rows[0]))
    }

    async save(student: Student): Promise<void> {
        await executeStatement(
            this.executor,
            `
                INSERT INTO students
                    (student_id, name, date_of_birth, band_level, current_progress_version)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    date_of_birth = VALUES(date_of_birth),
                    band_level = VALUES(band_level),
                    current_progress_version = VALUES(current_progress_version)
            `,
            [
                student.studentId,
                student.name,
                student.dateOfBirth,
                student.bandLevel,
                student.currentProgressVersion,
            ],
        )
    }
}
