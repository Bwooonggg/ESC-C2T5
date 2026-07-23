import { randomUUID } from 'node:crypto'

export interface GeneratorInvocationContext {
    readonly correlationId: string
    readonly idempotencyKey: string
}

export function createGeneratorInvocationContext(): GeneratorInvocationContext {
    return {
        correlationId: randomUUID(),
        idempotencyKey: randomUUID(),
    }
}

export function normalizeGeneratorInvocationContext(
    context: GeneratorInvocationContext,
): GeneratorInvocationContext {
    if (
        typeof context.correlationId !== 'string' ||
        context.correlationId.trim() === ''
    ) {
        throw new TypeError('Generator correlationId must be a non-empty string.')
    }

    if (
        typeof context.idempotencyKey !== 'string' ||
        context.idempotencyKey.trim() === ''
    ) {
        throw new TypeError(
            'Generator idempotencyKey must be a non-empty string.',
        )
    }

    return {
        correlationId: context.correlationId.trim(),
        idempotencyKey: context.idempotencyKey.trim(),
    }
}
