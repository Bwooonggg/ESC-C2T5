import type { Student } from '../../../domain/entities/student.js'

export interface StudentRepository {
    findById(studentId: string): Promise<Student | null>
    /** Persists student metadata, including the current progress version. */
    save(student: Student): Promise<void>
}
