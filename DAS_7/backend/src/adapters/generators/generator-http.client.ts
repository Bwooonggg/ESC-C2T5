import {
    normalizeGeneratorInvocationContext,
    type GeneratorInvocationContext,
} from '../../shared/generator-context.js'
import {
    GeneratorServiceError,
    type GeneratorErrorCode,
} from './generator-error.js'
import { parseGeneratorResponse } from './generator-response.schemas.js'
import type {
    GeneratorClient,
    GeneratorClientResponse,
} from './generator.adapter.js'

export interface GeneratorHttpResponse {
    readonly ok: boolean
    readonly status: number
    json(): Promise<unknown>
}

export type GeneratorFetch = (
    input: string | URL,
    init?: RequestInit,
) => Promise<GeneratorHttpResponse>

export interface GeneratorHttpClientOptions {
    readonly endpoint: string | URL
    readonly serviceName: string
    readonly timeoutMs: number
    readonly headers?: Readonly<Record<string, string>>
    readonly fetchImpl?: GeneratorFetch
}

export class GeneratorHttpClient<TRequest>
    implements GeneratorClient<TRequest>
{
    private readonly endpoint: string
    private readonly serviceName: string
    private readonly timeoutMs: number
    private readonly headers: Readonly<Record<string, string>>
    private readonly fetchImpl: GeneratorFetch

    constructor(options: GeneratorHttpClientOptions) {
        const endpoint = new URL(options.endpoint)

        if (!['http:', 'https:'].includes(endpoint.protocol)) {
            throw new TypeError('Generator endpoint must use http or https.')
        }

        if (
            !Number.isInteger(options.timeoutMs) ||
            options.timeoutMs <= 0
        ) {
            throw new TypeError('Generator timeoutMs must be a positive integer.')
        }

        if (options.serviceName.trim() === '') {
            throw new TypeError('Generator serviceName must be non-empty.')
        }

        this.endpoint = endpoint.toString()
        this.serviceName = options.serviceName.trim()
        this.timeoutMs = options.timeoutMs
        this.headers = { ...options.headers }
        this.fetchImpl = options.fetchImpl ?? fetch
    }

    async generate(
        request: TRequest,
        context: GeneratorInvocationContext,
    ): Promise<GeneratorClientResponse> {
        const invocationContext = normalizeGeneratorInvocationContext(context)
        const controller = new AbortController()
        let timedOut = false
        const timeout = setTimeout(() => {
            timedOut = true
            controller.abort()
        }, this.timeoutMs)

        try {
            const response = await this.fetchImpl(this.endpoint, {
                method: 'POST',
                headers: {
                    ...this.headers,
                    accept: 'application/json',
                    'content-type': 'application/json',
                    'x-correlation-id': invocationContext.correlationId,
                    'idempotency-key': invocationContext.idempotencyKey,
                },
                body: JSON.stringify(request),
                signal: controller.signal,
            })

            if (timedOut) {
                throw this.createTimeoutError(
                    invocationContext,
                    new Error('Generator response arrived after timeout.'),
                )
            }

            if (!response.ok) {
                throw this.createHttpError(
                    response.status,
                    invocationContext,
                )
            }

            let body: unknown
            try {
                body = await response.json()
            } catch (error) {
                throw new GeneratorServiceError({
                    code: 'INVALID_RESPONSE',
                    serviceName: this.serviceName,
                    correlationId: invocationContext.correlationId,
                    message: `${this.serviceName} returned invalid JSON.`,
                    retryable: false,
                    cause: error,
                })
            }

            if (timedOut) {
                throw this.createTimeoutError(
                    invocationContext,
                    new Error('Generator response arrived after timeout.'),
                )
            }

            return parseGeneratorResponse(body, {
                serviceName: this.serviceName,
                correlationId: invocationContext.correlationId,
            })
        } catch (error) {
            if (error instanceof GeneratorServiceError) {
                throw error
            }

            if (timedOut || isAbortError(error)) {
                throw this.createTimeoutError(invocationContext, error)
            }

            throw new GeneratorServiceError({
                code: 'UNAVAILABLE',
                serviceName: this.serviceName,
                correlationId: invocationContext.correlationId,
                message: `${this.serviceName} is unavailable.`,
                retryable: true,
                cause: error,
            })
        } finally {
            clearTimeout(timeout)
        }
    }

    private createHttpError(
        statusCode: number,
        context: GeneratorInvocationContext,
    ): GeneratorServiceError {
        const details = getHttpErrorDetails(statusCode)

        return new GeneratorServiceError({
            code: details.code,
            serviceName: this.serviceName,
            correlationId: context.correlationId,
            message: `${this.serviceName} request failed (${statusCode}).`,
            retryable: details.retryable,
            statusCode,
        })
    }

    private createTimeoutError(
        context: GeneratorInvocationContext,
        cause: unknown,
    ): GeneratorServiceError {
        return new GeneratorServiceError({
            code: 'TIMEOUT',
            serviceName: this.serviceName,
            correlationId: context.correlationId,
            message: `${this.serviceName} request timed out.`,
            retryable: true,
            cause,
        })
    }
}

function getHttpErrorDetails(statusCode: number): {
    readonly code: GeneratorErrorCode
    readonly retryable: boolean
} {
    if (statusCode === 401 || statusCode === 403) {
        return { code: 'AUTHENTICATION_FAILED', retryable: false }
    }

    if (statusCode === 408 || statusCode === 504) {
        return { code: 'TIMEOUT', retryable: true }
    }

    if (statusCode === 429) {
        return { code: 'RATE_LIMITED', retryable: true }
    }

    if (statusCode >= 500) {
        return { code: 'UNAVAILABLE', retryable: true }
    }

    return { code: 'REQUEST_FAILED', retryable: false }
}

function isAbortError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError'
    )
}
