import type { Parent } from '../../../domain/entities/parent.js'
import type { Student } from '../../../domain/entities/student.js'

export interface ParentRepository {
    findById(parentId: string): Promise<Parent | null>
    findByAuthUserId(authUserId: string): Promise<Parent | null>
    listStudents(parentId: string): Promise<readonly Student[]>
    isGuardianOf(parentId: string, studentId: string): Promise<boolean>
    save(parent: Parent): Promise<void>
    assignStudent(parentId: string, studentId: string): Promise<void>
}
