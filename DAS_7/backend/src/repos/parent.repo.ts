import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParentRepo } from '../deps.js';
import type { Parent } from '../types.js';
import { rowToParent, type ParentRow } from './mappers.js';

export function createParentRepo(client: SupabaseClient): ParentRepo {
    /** Guardianship links are a separate table, so every lookup needs a second query. */
    async function studentIdsOf(parentId: string): Promise<string[]> {
        const { data, error } = await client
            .from('parent_students')
            .select('student_id')
            .eq('parent_id', parentId);
        if (error) throw new Error(`db: ${error.message}`);
        return (data ?? []).map((row: { student_id: string }) => row.student_id);
    }

    async function withStudentIds(row: ParentRow | null): Promise<Parent | null> {
        if (row === null) return null;
        return rowToParent(row, await studentIdsOf(row.parent_id));
    }

    return {
        async byAuthUserId(authUserId: string): Promise<Parent | null> {
            const { data, error } = await client
                .from('parents')
                .select('*')
                .eq('auth_user_id', authUserId)
                .maybeSingle();
            if (error) throw new Error(`db: ${error.message}`);
            return withStudentIds(data as ParentRow | null);
        },

        async byId(parentId: string): Promise<Parent | null> {
            const { data, error } = await client
                .from('parents')
                .select('*')
                .eq('parent_id', parentId)
                .maybeSingle();
            if (error) throw new Error(`db: ${error.message}`);
            return withStudentIds(data as ParentRow | null);
        },
    };
}
