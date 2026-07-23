export class SupabaseInfrastructureError extends Error {
    readonly operation: string
    readonly code: string | null
    readonly status: number | null

    constructor(
        operation: string,
        message: string,
        details: {
            readonly code?: string | null
            readonly status?: number | null
            readonly cause?: unknown
        } = {},
    ) {
        super(`${operation}: ${message}`, { cause: details.cause })
        this.name = 'SupabaseInfrastructureError'
        this.operation = operation
        this.code = details.code ?? null
        this.status = details.status ?? null
    }
}

export class SupabaseRowMappingError extends SupabaseInfrastructureError {
    readonly table: string

    constructor(table: string, message: string, cause?: unknown) {
        super(`map ${table}`, message, { cause })
        this.name = 'SupabaseRowMappingError'
        this.table = table
    }
}

export function throwIfSupabaseError(
    error: {
        readonly message: string
        readonly code?: string
        readonly details?: string
        readonly hint?: string
        readonly status?: number
    } | null,
    operation: string,
): void {
    if (!error) {
        return
    }

    const context = [error.details, error.hint]
        .filter((value): value is string => Boolean(value))
        .join(' ')

    throw new SupabaseInfrastructureError(
        operation,
        context ? `${error.message} ${context}` : error.message,
        {
            code: error.code,
            status: error.status,
        },
    )
}
