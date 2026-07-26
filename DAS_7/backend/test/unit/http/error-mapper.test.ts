import { describe, expect, it } from '@jest/globals'
import { ZodError } from 'zod'
import { mapError } from '../../../src/http/responses/error-mapper.js'
import { LlmError } from '../../../src/infrastructure/llm/llm-error.js'
import type { LlmOperation } from '../../../src/infrastructure/llm/llm-error.js'
import { ValidationError } from '../../../src/domain/errors/domain.error.js'
import { ProgressUnavailableError } from '../../../src/domain/errors/progress-unavailable.error.js'
import { SummaryUnavailableError } from '../../../src/domain/errors/summary-unavailable.error.js'

function llmError(operation: LlmOperation): LlmError {
    return new LlmError({
        code: 'UNAVAILABLE',
        operation,
        provider: 'test-provider',
        correlationId: 'c1',
        message: 'upstream down',
        retryable: true,
    })
}

describe('mapError', () => {
    it('maps ProgressUnavailableError to 503 progressUnavailable', () => {
        expect(mapError(new ProgressUnavailableError())).toEqual({
            message: 'progressUnavailable',
            status: 503,
        })
    })

    it('maps SummaryUnavailableError to 404 summaryUnavailable', () => {
        expect(mapError(new SummaryUnavailableError())).toEqual({
            message: 'summaryUnavailable',
            status: 404,
        })
    })

    it('maps a recommendation LLM failure to recommendationUnavailable', () => {
        expect(mapError(llmError('recommendation'))).toEqual({
            message: 'recommendationUnavailable',
            status: 503,
        })
    })

    it('maps a summary LLM failure to summaryUnavailable', () => {
        expect(mapError(llmError('summary'))).toEqual({
            message: 'summaryUnavailable',
            status: 503,
        })
    })

    it('maps a ZodError to a 400 invalid request', () => {
        const zodError = new ZodError([])

        expect(mapError(zodError)).toEqual({
            message: 'Invalid request.',
            status: 400,
        })
    })

    it('maps a generic DomainError to 400 with its own message', () => {
        expect(mapError(new ValidationError('name is required'))).toEqual({
            message: 'name is required',
            status: 400,
        })
    })

    it('maps an unknown error to a generic 500', () => {
        expect(mapError(new Error('boom'))).toEqual({
            message: 'Something went wrong on the server.',
            status: 500,
        })
    })
})
