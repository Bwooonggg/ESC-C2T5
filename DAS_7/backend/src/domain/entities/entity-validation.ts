//
// Validation helpers for domain entities
//

import { ValidationError } from '../errors/domain.error.js'

export function requireText(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new ValidationError(`${field} must be a non-empty string.`)
    }

    return value.trim()
}

export function allowText(value: unknown, field: string): string {
    if (typeof value !== 'string') {
        throw new ValidationError(`${field} must be a string.`)
    }

    return value
}

export function requireDate(value: unknown, field: string): Date {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        throw new ValidationError(`${field} must be a valid Date.`)
    }

    return new Date(value.getTime())
}

export function requireOptionalDate(
    value: unknown,
    field: string,
): Date | null {
    if (value === null) {
        return null
    }

    return requireDate(value, field)
}

export function requireBoolean(value: unknown, field: string): boolean {
    if (typeof value !== 'boolean') {
        throw new ValidationError(`${field} must be a boolean.`)
    }

    return value
}

export function requireScore(value: unknown, field: string): number {
    const hasAtMostTwoDecimalPlaces =
        typeof value === 'number' &&
        Math.round(value * 100) / 100 === value

    if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 100 ||
        !hasAtMostTwoDecimalPlaces
    ) {
        throw new ValidationError(
            `${field} must be a number between 0 and 100 with at most two decimal places.`,
        )
    }

    return value
}

export function requireStringArray(
    value: unknown,
    field: string,
): readonly string[] {
    if (!Array.isArray(value)) {
        throw new ValidationError(`${field} must be an array.`)
    }

    return Object.freeze(
        value.map((item, index) => requireText(item, `${field}[${index}]`)),
    )
}
