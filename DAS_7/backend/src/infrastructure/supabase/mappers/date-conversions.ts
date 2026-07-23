import { SupabaseRowMappingError } from '../errors.js'

export function parsePostgresTimestamp(
    value: string,
    table: string,
    field: string,
): Date {
    const parsed = new Date(value)

    if (Number.isNaN(parsed.getTime())) {
        throw new SupabaseRowMappingError(
            table,
            `${field} must be a valid PostgreSQL timestamp.`,
        )
    }

    return parsed
}

export function parsePostgresDate(
    value: string,
    table: string,
    field: string,
): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new SupabaseRowMappingError(
            table,
            `${field} must be an ISO date in YYYY-MM-DD format.`,
        )
    }

    const parsed = new Date(`${value}T00:00:00.000Z`)

    const [year, month, day] = value.split('-').map(Number)

    if (
        Number.isNaN(parsed.getTime()) ||
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() + 1 !== month ||
        parsed.getUTCDate() !== day
    ) {
        throw new SupabaseRowMappingError(
            table,
            `${field} must be a valid PostgreSQL date.`,
        )
    }

    return parsed
}

export function toPostgresTimestamp(
    value: Date,
    field = 'timestamp',
): string {
    assertValidDate(value, field)
    return value.toISOString()
}

export function toPostgresDate(value: Date, field = 'date'): string {
    assertValidDate(value, field)
    return value.toISOString().slice(0, 10)
}

function assertValidDate(value: Date, field: string): void {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        throw new TypeError(`${field} must be a valid Date.`)
    }
}
