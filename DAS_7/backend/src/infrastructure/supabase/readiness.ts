import type { InsightSupabaseClient } from './clients/supabase-client.js'
import { SupabaseInfrastructureError } from './errors.js'
import { runSupabase } from './repositories/repository-support.js'
import type { ReadinessProbe } from '../../shared/readiness.js'
export type { ReadinessProbe } from '../../shared/readiness.js'

export class SupabaseReadinessProbe implements ReadinessProbe {
    constructor(
        private readonly client: InsightSupabaseClient,
        private readonly timeoutMs = 3_000,
    ) {
        if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
            throw new RangeError('timeoutMs must be a positive integer.')
        }
    }

    async check(): Promise<void> {
        const query = runSupabase(
            'supabase.readiness',
            () =>
                this.client
                    .from('student_profiles')
                    .select('student_id')
                    .limit(0),
        )

        let timeoutHandle: ReturnType<typeof setTimeout> | undefined

        try {
            await Promise.race([
                query,
                new Promise<never>((_, reject) => {
                    timeoutHandle = setTimeout(() => {
                        reject(
                            new SupabaseInfrastructureError(
                                'supabase.readiness',
                                `readiness check timed out after ${this.timeoutMs}ms.`,
                            ),
                        )
                    }, this.timeoutMs)
                }),
            ])
        } finally {
            if (timeoutHandle !== undefined) {
                clearTimeout(timeoutHandle)
            }
        }
    }
}
