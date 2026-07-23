import {
    createClient,
    type SupabaseClient,
} from '@supabase/supabase-js'
import type { Database } from '../generated/database.types.js'

export type InsightSupabaseClient = SupabaseClient<Database, 'insight'>

export interface SupabaseClientBaseOptions {
    readonly url: string
    readonly schema: string
}

export interface RequestSupabaseClientOptions
    extends SupabaseClientBaseOptions {
    readonly publishableKey: string
    readonly accessToken: string
}

export interface WorkerSupabaseClientOptions
    extends SupabaseClientBaseOptions {
    readonly secretKey: string
}

/**
 * Creates the request-scoped client used after R6 has verified an incoming
 * platform token. The access token is supplied through the SDK's supported
 * callback rather than by mutating global headers or a shared client.
 */
export function createRequestSupabaseClient(
    options: RequestSupabaseClientOptions,
): InsightSupabaseClient {
    assertBaseOptions(options)
    const publishableKey = requireCredential(
        options.publishableKey,
        'publishableKey',
    )
    const accessToken = requireCredential(
        options.accessToken,
        'accessToken',
    )

    return createClient<Database, 'insight'>(
        options.url,
        publishableKey,
        {
            db: { schema: 'insight' },
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false,
            },
            accessToken: async () => accessToken,
        },
    )
}

/**
 * Creates the worker-only system client. This function is intentionally not
 * imported by the API composition root; the secret key must never enter the
 * request-scoped dependency graph.
 */
export function createWorkerSupabaseClient(
    options: WorkerSupabaseClientOptions,
): InsightSupabaseClient {
    assertBaseOptions(options)
    const secretKey = requireCredential(options.secretKey, 'secretKey')

    return createClient<Database, 'insight'>(
        options.url,
        secretKey,
        {
            db: { schema: 'insight' },
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false,
            },
        },
    )
}

function assertBaseOptions(
    options: SupabaseClientBaseOptions,
): void {
    requireCredential(options.url, 'url')

    if (options.schema !== 'insight') {
        throw new TypeError(
            `schema must be "insight"; received "${options.schema}".`,
        )
    }
}

function requireCredential(value: string, field: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new TypeError(`${field} is required.`)
    }

    return value.trim()
}
