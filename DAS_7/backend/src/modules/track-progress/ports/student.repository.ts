import type { Student } from '../../../domain/entities/student.js'

export interface StudentRepository {
    findById(studentId: string): Promise<Student | null>
    save(student: Student): Promise<void>
}
