import type { Json } from '../generated/database.types.js'

export function toProgressVersion(value: string, field: string): number {
    const normalized = value.trim().replace(/^v/i, '')
    const parsed = Number(normalized)

    if (
        !/^\d+$/.test(normalized) ||
        !Number.isSafeInteger(parsed) ||
        parsed < 0
    ) {
        throw new TypeError(
            `${field} must be a non-negative numeric version such as v3.`,
        )
    }

    return parsed
}

export function asJsonObject(
    value: Readonly<Record<string, unknown>>,
): Json {
    return { ...value } as Json
}

export function asNullableJsonObject(
    value: Readonly<Record<string, unknown>> | null,
): Json | null {
    return value === null ? null : ({ ...value } as Json)
}

