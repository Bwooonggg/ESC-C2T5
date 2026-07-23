import { z } from 'zod'
import type { GeneratorClientResponse } from './generator.adapter.js'
import {
    GeneratorServiceError,
    type GeneratorServiceErrorProps,
} from './generator-error.js'

export const generatorResponseSchema = z.object({
    content: z.string().trim().min(1),
    metadata: z.record(z.string(), z.unknown()).optional(),
})

export function parseGeneratorResponse(
    value: unknown,
    errorContext: Pick<
        GeneratorServiceErrorProps,
        'serviceName' | 'correlationId'
    >,
): GeneratorClientResponse {
    const parsed = generatorResponseSchema.safeParse(value)

    if (!parsed.success) {
        throw new GeneratorServiceError({
            ...errorContext,
            code: 'INVALID_RESPONSE',
            message: `${errorContext.serviceName} returned an invalid response.`,
            retryable: false,
            cause: parsed.error,
        })
    }

    return parsed.data
}
