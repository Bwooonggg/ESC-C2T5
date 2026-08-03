import type { SupabaseClient } from '@supabase/supabase-js';
import type { StudentRepo } from '../deps.js';
import type { Student } from '../types.js';
import { rowToStudent, type StudentRow } from './mappers.js';

export function createStudentRepo(client: SupabaseClient): StudentRepo {
    return {
        async byId(studentId: string): Promise<Student | null> {
            const { data, error } = await client
                .from('students')
                .select('*')
                .eq('student_id', studentId)
                .maybeSingle(); // returns 0 or 1 rows
            if (error) throw new Error(`db: ${error.message}`);
            return data === null ? null : rowToStudent(data as StudentRow);
        },
        
        /** Returns all students connected to parent*/
        async listByParent(parentId: string): Promise<Student[]> {
            const links = await client
                .from('parent_students')
                .select('student_id')
                .eq('parent_id', parentId);
            if (links.error) throw new Error(`db: ${links.error.message}`);

            const ids = (links.data ?? []).map((row: { student_id: string }) => row.student_id);
            if (ids.length === 0) return [];

            const { data, error } = await client
                .from('students')
                .select('*')
                .in('student_id', ids);
            if (error) throw new Error(`db: ${error.message}`);
            return (data ?? []).map((row: StudentRow) => rowToStudent(row));
        },

        /** Checks if Parent is connected to the Student */
        async isGuardian(parentId: string, studentId: string): Promise<boolean> {
            const { data, error } = await client
                .from('parent_students')
                .select('student_id')
                .eq('parent_id', parentId)
                .eq('student_id', studentId)
                .maybeSingle();
            if (error) throw new Error(`db: ${error.message}`);
            return data !== null;
        },
    };
}
