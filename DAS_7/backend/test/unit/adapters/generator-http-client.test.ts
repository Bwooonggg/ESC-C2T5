import { describe, expect, it, jest } from '@jest/globals'
import {
    GeneratorHttpClient,
    type GeneratorFetch,
    type GeneratorHttpResponse,
} from '../../../src/adapters/generators/index.js'

const context = {
    correlationId: 'request-123',
    idempotencyKey: 'generation-123',
}

describe('GeneratorHttpClient', () => {
    it('sends JSON with correlation and idempotency headers', async () => {
        let requestInit: RequestInit | undefined
        const fetchImpl: GeneratorFetch = jest.fn(
            async (
                _input: string | URL,
                init?: RequestInit,
            ): Promise<GeneratorHttpResponse> => {
                requestInit = init
                return jsonResponse(200, {
                    content: 'Generated content',
                    metadata: { providerRequestId: 'provider-123' },
                })
            },
        )
        const client = new GeneratorHttpClient({
            endpoint: 'https://generator.example.test/generate',
            serviceName: 'SummaryGeneratorService',
            timeoutMs: 1_000,
            headers: { authorization: 'Bearer test-token' },
            fetchImpl,
        })

        await expect(client.generate({ input: 'progress' }, context)).resolves.toEqual(
            {
                content: 'Generated content',
                metadata: { providerRequestId: 'provider-123' },
            },
        )

        expect(requestInit).toMatchObject({
            method: 'POST',
            body: JSON.stringify({ input: 'progress' }),
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                'x-correlation-id': 'request-123',
                'idempotency-key': 'generation-123',
                authorization: 'Bearer test-token',
            },
        })
    })

    it('rejects malformed provider responses without exposing the payload', async () => {
        const fetchImpl: GeneratorFetch = jest.fn(async () =>
            jsonResponse(200, { summary: 'wrong shape' }),
        )
        const client = new GeneratorHttpClient({
            endpoint: 'https://generator.example.test/generate',
            serviceName: 'SummaryGeneratorService',
            timeoutMs: 1_000,
            fetchImpl,
        })

        await expect(client.generate({}, context)).rejects.toMatchObject({
            name: 'GeneratorServiceError',
            code: 'INVALID_RESPONSE',
            serviceName: 'SummaryGeneratorService',
            correlationId: 'request-123',
            retryable: false,
        })
    })

    it('maps provider status failures to provider-neutral errors', async () => {
        const fetchImpl: GeneratorFetch = jest.fn(async () =>
            jsonResponse(429, { error: 'slow down' }),
        )
        const client = new GeneratorHttpClient({
            endpoint: 'https://generator.example.test/generate',
            serviceName: 'RecommendationGeneratorService',
            timeoutMs: 1_000,
            fetchImpl,
        })

        await expect(client.generate({}, context)).rejects.toMatchObject({
            code: 'RATE_LIMITED',
            statusCode: 429,
            retryable: true,
        })
    })

    it('aborts and normalizes requests that exceed the timeout', async () => {
        jest.useFakeTimers()

        try {
            const fetchImpl: GeneratorFetch = jest.fn(
                async (
                    _input: string | URL,
                    init?: RequestInit,
                ): Promise<GeneratorHttpResponse> =>
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
            const client = new GeneratorHttpClient({
                endpoint: 'https://generator.example.test/generate',
                serviceName: 'SummaryGeneratorService',
                timeoutMs: 50,
                fetchImpl,
            })

            const result = expect(client.generate({}, context)).rejects.toMatchObject(
                {
                    code: 'TIMEOUT',
                    correlationId: 'request-123',
                    retryable: true,
                },
            )
            await jest.advanceTimersByTimeAsync(50)

            await result
        } finally {
            jest.useRealTimers()
        }
    })
})

function jsonResponse(
    status: number,
    body: unknown,
): GeneratorHttpResponse {
    return {
        ok: status >= 200 && status < 300,
        status,
        async json(): Promise<unknown> {
            return body
        },
    }
}
