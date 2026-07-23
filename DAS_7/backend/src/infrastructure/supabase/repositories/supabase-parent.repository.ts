import type { Parent } from '../../../domain/entities/parent.js'
import type { Student } from '../../../domain/entities/student.js'
import type { ParentRepository } from '../../../modules/parents/ports/parent.repository.js'
import {
    mapParentRow,
    mapParentStudentToInsert,
    mapParentToInsert,
    mapStudentRow,
} from '../mappers/index.js'
import {
    parentProfileRowSchema,
    parseInsightRow,
    parentStudentRowSchema,
    studentProfileRowSchema,
    type ParentProfileRow,
    type StudentProfileRow,
} from '../mappers/row-schemas.js'
import type { InsightSupabaseClient } from '../clients/supabase-client.js'
import { runSupabase } from './repository-support.js'

export class SupabaseParentRepository implements ParentRepository {
    constructor(private readonly client: InsightSupabaseClient) {}

    async findById(parentId: string): Promise<Parent | null> {
        const rows = await runSupabase(
            'supabase.parent_profiles.findById',
            () =>
                this.client
                    .from('parent_profiles')
                    .select('*')
                    .eq('parent_id', parentId)
                    .limit(1),
        )

        const row = rows[0] as ParentProfileRow | undefined
        return row === undefined
            ? null
            : mapParentRow(
                  parseInsightRow(
                      parentProfileRowSchema,
                      row,
                      'parent_profiles',
                  ),
              )
    }

    async findByAuthUserId(authUserId: string): Promise<Parent | null> {
        const rows = await runSupabase(
            'supabase.parent_profiles.findByAuthUserId',
            () =>
                this.client
                    .from('parent_profiles')
                    .select('*')
                    .eq('auth_user_id', authUserId)
                    .limit(1),
        )

        const row = rows[0] as ParentProfileRow | undefined
        return row === undefined
            ? null
            : mapParentRow(
                  parseInsightRow(
                      parentProfileRowSchema,
                      row,
                      'parent_profiles',
                  ),
              )
    }

    async listStudents(parentId: string): Promise<readonly Student[]> {
        const assignments = await runSupabase(
            'supabase.parent_students.listByParent',
            () =>
                this.client
                    .from('parent_students')
                    .select('*')
                    .eq('parent_id', parentId)
                    .order('student_id', { ascending: true }),
        )

        const studentIds = assignments.map(
            (assignment) =>
                parseInsightRow(
                    parentStudentRowSchema,
                    assignment,
                    'parent_students',
                ).student_id,
        )
        if (studentIds.length === 0) {
            return []
        }

        const rows = await runSupabase(
            'supabase.student_profiles.listByParent',
            () =>
                this.client
                    .from('student_profiles')
                    .select('*')
                    .in('student_id', studentIds)
                    .order('student_id', { ascending: true }),
        )

        return rows.map((row) =>
            mapStudentRow(
                parseInsightRow(
                    studentProfileRowSchema,
                    row,
                    'student_profiles',
                ),
            ),
        )
    }

    async isGuardianOf(parentId: string, studentId: string): Promise<boolean> {
        const rows = await runSupabase(
            'supabase.parent_students.isGuardianOf',
            () =>
                this.client
                    .from('parent_students')
                    .select('parent_id')
                    .eq('parent_id', parentId)
                    .eq('student_id', studentId)
                    .limit(1),
        )

        return rows.length > 0
    }

    async save(parent: Parent): Promise<void> {
        await runSupabase(
            'supabase.parent_profiles.save',
            () =>
                this.client
                    .from('parent_profiles')
                    .upsert(mapParentToInsert(parent), {
                        onConflict: 'parent_id',
                    }),
        )
    }

    async assignStudent(parentId: string, studentId: string): Promise<void> {
        await runSupabase(
            'supabase.parent_students.assignStudent',
            () =>
                this.client
                    .from('parent_students')
                    .upsert(mapParentStudentToInsert(parentId, studentId), {
                        onConflict: 'parent_id,student_id',
                    }),
        )
    }
}
