import type { PostgrestError } from '@supabase/supabase-js'
import { SupabaseInfrastructureError, throwIfSupabaseError } from '../errors.js'

export async function runSupabase<T>(
    operation: string,
    action: () => PromiseLike<{
        readonly data: T | null
        readonly error: PostgrestError | null
    }>,
): Promise<T> {
    try {
        const result = await action()
        throwIfSupabaseError(result.error, operation)
        return result.data as T
    } catch (error) {
        if (error instanceof SupabaseInfrastructureError) {
            throw error
        }

        throw new SupabaseInfrastructureError(
            operation,
            error instanceof Error ? error.message : String(error),
            { cause: error },
        )
    }
}

export function requireNonNegativeLimit(limit: number): void {
    if (!Number.isInteger(limit) || limit < 0) {
        throw new RangeError('limit must be a non-negative integer.')
    }
}

export function requirePositiveLimit(limit: number): void {
    if (!Number.isInteger(limit) || limit < 1) {
        throw new RangeError('limit must be a positive integer.')
    }
}
