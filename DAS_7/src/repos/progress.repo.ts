import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProgressRepo } from '../deps.js';
import type { ProgressRecord } from '../types.js';
import { rowToProgressRecord, type ProgressRecordRow } from './mappers.js';

export function createProgressRepo(client: SupabaseClient): ProgressRepo {
    return {
        async listByStudent(studentId: string): Promise<ProgressRecord[]> {
            const { data, error } = await client
                .from('progress_records')
                .select('*')
                .eq('student_id', studentId)
                .order('date', { ascending: true });
            if (error) throw new Error(`db: ${error.message}`);
            return (data ?? []).map((row: ProgressRecordRow) => rowToProgressRecord(row));
        },

        /** Insertion time, not the record's date — this is what staleness checks compare. */
        async latestCreatedAt(studentId: string): Promise<string | null> {
            const { data, error } = await client
                .from('progress_records')
                .select('created_at')
                .eq('student_id', studentId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) throw new Error(`db: ${error.message}`);
            return data === null ? null : (data as { created_at: string }).created_at;
        },
    };
}
