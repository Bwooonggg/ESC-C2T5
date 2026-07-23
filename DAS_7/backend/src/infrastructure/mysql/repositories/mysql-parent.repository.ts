import type { Parent } from '../../../domain/entities/parent.js'
import type { Student } from '../../../domain/entities/student.js'
import type { ParentRepository } from '../../../modules/parents/ports/parent.repository.js'
import type { RowDataPacket } from 'mysql2/promise'
import { mapParentRow, mapStudentRow } from '../mappers/index.js'
import {
    asMysqlRow,
    executeRows,
    executeStatement,
    type MySqlExecutor,
} from './mysql-repository.js'

interface ParentRow extends RowDataPacket {}
interface StudentRow extends RowDataPacket {}
interface ExistsRow extends RowDataPacket {
    readonly guardian_exists: number
}

const parentColumns = `
    p.parent_id, p.name, u.user_id AS auth_user_id
`

export class MySqlParentRepository implements ParentRepository {
    constructor(private readonly executor: MySqlExecutor) {}

    async findById(parentId: string): Promise<Parent | null> {
        const rows = await executeRows<ParentRow>(
            this.executor,
            `
                SELECT ${parentColumns}
                FROM parents p
                INNER JOIN users u ON u.user_id = p.user_id
                WHERE p.parent_id = ?
                LIMIT 1
            `,
            [parentId],
        )

        return rows[0] === undefined
            ? null
            : mapParentRow(asMysqlRow(rows[0]))
    }

    async findByAuthUserId(authUserId: string): Promise<Parent | null> {
        const rows = await executeRows<ParentRow>(
            this.executor,
            `
                SELECT ${parentColumns}
                FROM parents p
                INNER JOIN users u ON u.user_id = p.user_id
                WHERE u.user_id = ?
                LIMIT 1
            `,
            [authUserId],
        )

        return rows[0] === undefined
            ? null
            : mapParentRow(asMysqlRow(rows[0]))
    }

    async listStudents(parentId: string): Promise<readonly Student[]> {
        const rows = await executeRows<StudentRow>(
            this.executor,
            `
                SELECT
                    s.student_id, s.name, s.date_of_birth, s.band_level,
                    s.current_progress_version
                FROM parent_students ps
                INNER JOIN students s ON s.student_id = ps.student_id
                WHERE ps.parent_id = ?
                ORDER BY s.student_id ASC
            `,
            [parentId],
        )

        return rows.map((row) => mapStudentRow(asMysqlRow(row)))
    }

    async isGuardianOf(parentId: string, studentId: string): Promise<boolean> {
        const rows = await executeRows<ExistsRow>(
            this.executor,
            `
                SELECT 1 AS guardian_exists
                FROM parent_students
                WHERE parent_id = ? AND student_id = ?
                LIMIT 1
            `,
            [parentId, studentId],
        )

        return rows.length > 0
    }

    async save(parent: Parent): Promise<void> {
        await executeStatement(
            this.executor,
            `
                INSERT INTO parents (parent_id, user_id, name)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    user_id = VALUES(user_id),
                    name = VALUES(name)
            `,
            [parent.parentId, parent.authUserId, parent.name],
        )
    }

    async assignStudent(parentId: string, studentId: string): Promise<void> {
        await executeStatement(
            this.executor,
            `
                INSERT INTO parent_students (parent_id, student_id)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE
                    assigned_at = assigned_at
            `,
            [parentId, studentId],
        )
    }
}
