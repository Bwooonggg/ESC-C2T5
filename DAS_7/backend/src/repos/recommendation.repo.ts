import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecommendationRepo } from '../deps.js';
import type { Recommendation } from '../types.js';
import { rowToRecommendation, type RecommendationRow } from './mappers.js';

export function createRecommendationRepo(client: SupabaseClient): RecommendationRepo {
    return {
        /** The id and generated_at come from the database, so the row is read back. */
        async insert(input: { summaryId: string; content: string }): Promise<Recommendation> {
            const { data, error } = await client
                .from('recommendations')
                .insert({ summary_id: input.summaryId, content: input.content })
                .select()
                .single();
            if (error) throw new Error(`db: ${error.message}`);
            return rowToRecommendation(data as RecommendationRow);
        },
    };
}
