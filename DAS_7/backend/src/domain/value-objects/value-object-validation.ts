import { ValidationError } from '../errors/domain.error.js'

export function requireValueText(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new ValidationError(`${field} must be a non-empty string.`)
    }

    return value.trim()
}

export function requireKnownValue<T extends string>(
    value: unknown,
    field: string,
    allowedValues: readonly T[],
): T {
    const normalizedValue = requireValueText(value, field)

    if (!allowedValues.includes(normalizedValue as T)) {
        throw new ValidationError(
            `${field} must be one of: ${allowedValues.join(', ')}.`,
        )
    }

    return normalizedValue as T
}
