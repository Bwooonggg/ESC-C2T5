import type { Student } from '../../../domain/entities/student.js'
import type { StudentRepository } from '../../../modules/track-progress/ports/student.repository.js'
import type { InsightSupabaseClient } from '../clients/supabase-client.js'
import {
    mapStudentRow,
    mapStudentToInsert,
} from '../mappers/index.js'
import {
    parseInsightRow,
    studentProfileRowSchema,
    type StudentProfileRow,
} from '../mappers/row-schemas.js'
import { runSupabase } from './repository-support.js'

export class SupabaseStudentRepository implements StudentRepository {
    constructor(private readonly client: InsightSupabaseClient) {}

    async findById(studentId: string): Promise<Student | null> {
        const rows = await runSupabase(
            'supabase.student_profiles.findById',
            () =>
                this.client
                    .from('student_profiles')
                    .select('*')
                    .eq('student_id', studentId)
                    .limit(1),
        )

        const row = rows[0] as StudentProfileRow | undefined
        return row === undefined
            ? null
            : mapStudentRow(
                  parseInsightRow(
                      studentProfileRowSchema,
                      row,
                      'student_profiles',
                  ),
              )
    }

    async save(student: Student): Promise<void> {
        await runSupabase(
            'supabase.student_profiles.save',
            () =>
                this.client
                    .from('student_profiles')
                    .upsert(mapStudentToInsert(student), {
                        onConflict: 'student_id',
                    }),
        )
    }
}
