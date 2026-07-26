import { describe, expect, it, jest } from '@jest/globals'
import {
    HttpLlmClient,
    type HttpLlmClientOptions,
    type LlmFetch,
    type LlmHttpResponse,
} from '../../../src/infrastructure/llm/http-llm.client.js'
import type { LlmCompletionRequest } from '../../../src/infrastructure/llm/llm-client.port.js'
import type { LlmErrorCode } from '../../../src/infrastructure/llm/llm-error.js'
import type { GeneratorInvocationContext } from '../../../src/shared/generator-context.js'

const context: GeneratorInvocationContext = {
    correlationId: 'request-123',
    idempotencyKey: 'generation-123',
}

const request: LlmCompletionRequest = {
    operation: 'summary',
    promptVersion: 'summary-2026-07-1',
    instructions: 'Write a short progress summary.',
    input: '{"student":{"name":"A Student"}}',
    outputName: 'student_progress_summary',
    maxOutputTokens: 400,
}

describe('HttpLlmClient', () => {
    it('sends the neutral envelope with credential, correlation, and idempotency headers', async () => {
        let requestUrl: string | URL | undefined
        let requestInit: RequestInit | undefined
        const fetchImpl: LlmFetch = jest.fn(
            async (
                input: string | URL,
                init?: RequestInit,
            ): Promise<LlmHttpResponse> => {
                requestUrl = input
                requestInit = init
                return jsonResponse(200, { output: { summary: 'Generated.' } })
            },
        )

        await makeClient({ fetchImpl }).complete(request, context)

        expect(requestUrl).toBe('https://llm.example.test/v1/complete')
        expect(requestInit).toMatchObject({
            method: 'POST',
            headers: {
                authorization: 'Bearer test-api-key',
                accept: 'application/json',
                'content-type': 'application/json',
                'x-correlation-id': 'request-123',
                'idempotency-key': 'generation-123',
            },
        })
        expect(JSON.parse(String(requestInit?.body))).toEqual({
            model: 'test-model',
            promptVersion: 'summary-2026-07-1',
            outputName: 'student_progress_summary',
            instructions: 'Write a short progress summary.',
            input: '{"student":{"name":"A Student"}}',
            maxOutputTokens: 400,
        })
    })

    it('returns the provider output with full generation metadata', async () => {
        const fetchImpl: LlmFetch = jest.fn(async () =>
            jsonResponse(200, {
                output: { summary: 'Generated.' },
                model: 'provider-model-9',
                requestId: 'provider-123',
            }),
        )

        await expect(
            makeClient({ fetchImpl }).complete(request, context),
        ).resolves.toEqual({
            output: { summary: 'Generated.' },
            metadata: {
                provider: 'test-provider',
                model: 'provider-model-9',
                promptVersion: 'summary-2026-07-1',
                providerRequestId: 'provider-123',
                generatedAt: '2026-07-25T09:30:00.000Z',
            },
        })
    })

    it('falls back to the configured model when the provider omits it', async () => {
        const fetchImpl: LlmFetch = jest.fn(async () =>
            jsonResponse(200, { output: { summary: 'Generated.' } }),
        )

        const response = await makeClient({ fetchImpl }).complete(
            request,
            context,
        )

        expect(response.metadata.model).toBe('test-model')
        expect(response.metadata.providerRequestId).toBeUndefined()
    })

    it.each<[number, LlmErrorCode, boolean]>([
        [401, 'AUTHENTICATION_FAILED', false],
        [403, 'AUTHENTICATION_FAILED', false],
        [408, 'TIMEOUT', true],
        [429, 'RATE_LIMITED', true],
        [500, 'UNAVAILABLE', true],
        [504, 'TIMEOUT', true],
        [400, 'REQUEST_FAILED', false],
    ])(
        'maps provider status %p to a provider-neutral %s error',
        async (status, code, retryable) => {
            const fetchImpl: LlmFetch = jest.fn(async () =>
                jsonResponse(status, { error: 'provider said no' }),
            )

            await expect(
                makeClient({ fetchImpl }).complete(request, context),
            ).rejects.toMatchObject({
                name: 'LlmError',
                code,
                statusCode: status,
                retryable,
                operation: 'summary',
                provider: 'test-provider',
                correlationId: 'request-123',
            })
        },
    )

    it('rejects an unrecognized response envelope without echoing the payload', async () => {
        const fetchImpl: LlmFetch = jest.fn(async () =>
            jsonResponse(200, 'a bare string, not an envelope'),
        )

        const failure = await captureError(() =>
            makeClient({ fetchImpl }).complete(request, context),
        )

        expect(failure).toMatchObject({
            name: 'LlmError',
            code: 'INVALID_RESPONSE',
            retryable: false,
        })
        expect((failure as Error).message).not.toContain('a bare string')
    })

    it('rejects a body that is not valid JSON', async () => {
        const fetchImpl: LlmFetch = jest.fn(async () => ({
            ok: true,
            status: 200,
            async json(): Promise<unknown> {
                throw new SyntaxError('Unexpected token < in JSON')
            },
        }))

        await expect(
            makeClient({ fetchImpl }).complete(request, context),
        ).rejects.toMatchObject({
            name: 'LlmError',
            code: 'INVALID_RESPONSE',
            retryable: false,
        })
    })

    it('aborts and normalizes a request that exceeds the timeout', async () => {
        jest.useFakeTimers()

        try {
            const fetchImpl: LlmFetch = jest.fn(
                async (
                    _input: string | URL,
                    init?: RequestInit,
                ): Promise<LlmHttpResponse> =>
                    new Promise((_resolve, reject) => {
                        init?.signal?.addEventListener('abort', () => {
                            reject(
                                Object.assign(new Error('aborted'), {
                                    name: 'AbortError',
                                }),
                            )
                        })
                    }),
            )

            const result = expect(
                makeClient({ fetchImpl, timeoutMs: 50 }).complete(
                    request,
                    context,
                ),
            ).rejects.toMatchObject({
                name: 'LlmError',
                code: 'TIMEOUT',
                correlationId: 'request-123',
                retryable: true,
            })
            await jest.advanceTimersByTimeAsync(50)

            await result
        } finally {
            jest.useRealTimers()
        }
    })

    it('normalizes an unexpected transport failure to UNAVAILABLE', async () => {
        const fetchImpl: LlmFetch = jest.fn(async () => {
            throw new Error('socket hang up')
        })

        await expect(
            makeClient({ fetchImpl }).complete(request, context),
        ).rejects.toMatchObject({
            name: 'LlmError',
            code: 'UNAVAILABLE',
            retryable: true,
        })
    })

    it.each<[string, Partial<HttpLlmClientOptions>]>([
        ['a non-http API base URL', { apiBaseUrl: 'ftp://llm.example.test' }],
        ['a blank provider', { provider: '  ' }],
        ['a blank model', { model: '  ' }],
        ['a blank API key', { apiKey: '  ' }],
        ['a non-positive timeout', { timeoutMs: 0 }],
        ['a fractional timeout', { timeoutMs: 1.5 }],
    ])('refuses to construct with %s', (_label, overrides) => {
        expect(() => makeClient(overrides)).toThrow(TypeError)
    })
})

function makeClient(
    overrides: Partial<HttpLlmClientOptions> = {},
): HttpLlmClient {
    return new HttpLlmClient({
        provider: 'test-provider',
        apiBaseUrl: 'https://llm.example.test/v1/complete',
        apiKey: 'test-api-key',
        model: 'test-model',
        timeoutMs: 1_000,
        now: () => new Date('2026-07-25T09:30:00.000Z'),
        ...overrides,
    })
}

function jsonResponse(status: number, body: unknown): LlmHttpResponse {
    return {
        ok: status >= 200 && status < 300,
        status,
        async json(): Promise<unknown> {
            return body
        },
    }
}

async function captureError(action: () => Promise<unknown>): Promise<unknown> {
    try {
        await action()
    } catch (error) {
        return error
    }

    throw new Error('Expected the completion to fail')
}
