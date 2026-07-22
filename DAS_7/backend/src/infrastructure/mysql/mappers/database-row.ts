export type MysqlRow = Readonly<Record<string, unknown>>

export class MysqlRowMappingError extends Error {
    readonly field: string

    constructor(field: string, reason: string) {
        super(`Could not map MySQL field "${field}": ${reason}.`)
        this.name = 'MysqlRowMappingError'
        this.field = field
    }
}

// Validate and return MySQL values

export function readString(row: MysqlRow, field: string): string {
    const value = readValue(row, field)

    if (typeof value !== 'string') {
        throw new MysqlRowMappingError(field, 'expected a string')
    }

    return value
}

export function readNullableString(
    row: MysqlRow,
    field: string,
): string | null {
    const value = readValue(row, field)

    if (value === null) {
        return null
    }

    if (typeof value !== 'string') {
        throw new MysqlRowMappingError(field, 'expected a string or null')
    }

    return value
}

export function readDate(row: MysqlRow, field: string): Date {
    return parseDate(readValue(row, field), field)
}

export function readNullableDate(
    row: MysqlRow,
    field: string,
): Date | null {
    const value = readValue(row, field)

    if (value === null) {
        return null
    }

    return parseDate(value, field)
}

export function readBoolean(row: MysqlRow, field: string): boolean {
    const value = readValue(row, field)

    if (typeof value === 'boolean') {
        return value
    }

    if (value === 0 || value === '0') {
        return false
    }

    if (value === 1 || value === '1') {
        return true
    }

    throw new MysqlRowMappingError(field, 'expected a boolean or 0/1')
}

export function readNumber(row: MysqlRow, field: string): number {
    const value = readValue(row, field)
    const numberValue =
        typeof value === 'number'
            ? value
            : typeof value === 'string' && value.trim() !== ''
              ? Number(value)
              : Number.NaN

    if (!Number.isFinite(numberValue)) {
        throw new MysqlRowMappingError(field, 'expected a finite number')
    }

    return numberValue
}

export function readInteger(row: MysqlRow, field: string): number {
    const numberValue = readNumber(row, field)

    if (!Number.isInteger(numberValue)) {
        throw new MysqlRowMappingError(field, 'expected an integer')
    }

    return numberValue
}

export function readKnownValue<T extends string>(
    row: MysqlRow,
    field: string,
    allowedValues: readonly T[],
): T {
    const value = readString(row, field)

    if (!allowedValues.includes(value as T)) {
        throw new MysqlRowMappingError(
            field,
            `expected one of ${allowedValues.join(', ')}`,
        )
    }

    return value as T
}

export function readOptionalStringArray(
    row: MysqlRow,
    field: string,
): readonly string[] {
    const value = row[field]

    if (value === undefined || value === null) {
        return []
    }

    const parsedValue =
        typeof value === 'string' ? parseJson(value, field) : value

    if (!Array.isArray(parsedValue)) {
        throw new MysqlRowMappingError(field, 'expected an array or null')
    }

    return Object.freeze(
        parsedValue.map((item, index) => {
            if (typeof item !== 'string') {
                throw new MysqlRowMappingError(
                    `${field}[${index}]`,
                    'expected a string',
                )
            }

            return item
        }),
    )
}

export function readJsonObject(
    row: MysqlRow,
    field: string,
): Readonly<Record<string, unknown>> {
    const value = readValue(row, field)
    const parsedValue =
        typeof value === 'string' ? parseJson(value, field) : value

    if (
        parsedValue === null ||
        typeof parsedValue !== 'object' ||
        Array.isArray(parsedValue)
    ) {
        throw new MysqlRowMappingError(
            field,
            'expected a JSON object',
        )
    }

    return Object.freeze({
        ...(parsedValue as Record<string, unknown>),
    })
}

function readValue(row: MysqlRow, field: string): unknown {
    const value = row[field]

    if (value === undefined) {
        throw new MysqlRowMappingError(field, 'field is missing')
    }

    return value
}

function parseDate(value: unknown, field: string): Date {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            throw new MysqlRowMappingError(field, 'expected a valid date')
        }

        return new Date(value.getTime())
    }

    if (typeof value !== 'string' && typeof value !== 'number') {
        throw new MysqlRowMappingError(
            field,
            'expected a Date, date string, or timestamp',
        )
    }

    const date =
        typeof value === 'number'
            ? new Date(value)
            : new Date(toUtcIsoString(value))

    if (Number.isNaN(date.getTime())) {
        throw new MysqlRowMappingError(field, 'expected a valid date')
    }

    return date
}

function toUtcIsoString(value: string): string {
    const trimmedValue = value.trim()

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
        return `${trimmedValue}T00:00:00.000Z`
    }

    const isoValue = trimmedValue.replace(' ', 'T')

    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(isoValue)) {
        return isoValue
    }

    return `${isoValue}Z`
}

function parseJson(value: string, field: string): unknown {
    try {
        return JSON.parse(value)
    } catch {
        throw new MysqlRowMappingError(field, 'expected valid JSON')
    }
}
