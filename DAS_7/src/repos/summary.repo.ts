import type { SupabaseClient } from '@supabase/supabase-js';
import type { SummaryRepo } from '../deps.js';
import type { Summary } from '../types.js';
import { rowToSummary, type SummaryRow } from './mappers.js';

export function createSummaryRepo(client: SupabaseClient): SummaryRepo {
    return {
        async latestByStudent(studentId: string): Promise<Summary | null> {
            const { data, error } = await client
                .from('summaries')
                .select('*')
                .eq('student_id', studentId)
                .order('generated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) throw new Error(`db: ${error.message}`);
            return data === null ? null : rowToSummary(data as SummaryRow);
        },

        /** The id and generated_at come from the database, so the row is read back. */
        async insert(input: { studentId: string; content: string }): Promise<Summary> {
            const { data, error } = await client
                .from('summaries')
                .insert({ student_id: input.studentId, content: input.content })
                .select()
                .single();
            if (error) throw new Error(`db: ${error.message}`);
            return rowToSummary(data as SummaryRow);
        },
    };
}
