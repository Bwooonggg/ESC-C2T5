import { z } from 'zod'
import {
    normalizeGeneratorInvocationContext,
    type GeneratorInvocationContext,
} from '../../shared/generator-context.js'
import type {
    LlmClientPort,
    LlmCompletionRequest,
    LlmCompletionResponse,
} from './llm-client.port.js'
import { LlmError, type LlmErrorCode } from './llm-error.js'

export interface LlmHttpResponse {
    readonly ok: boolean
    readonly status: number
    json(): Promise<unknown>
}

export type LlmFetch = (
    input: string | URL,
    init?: RequestInit,
) => Promise<LlmHttpResponse>

export interface HttpLlmClientOptions {
    readonly provider: string
    readonly apiBaseUrl: string | URL
    readonly apiKey: string
    readonly model: string
    readonly timeoutMs: number
    readonly fetchImpl?: LlmFetch
    readonly now?: () => Date
}

/**
 * The single LLM transport. It centralizes credentials, timeout and
 * cancellation, provider error classification, and structured-output
 * extraction for both generator adapters.
 *
 * The wire body below is the neutral request/response envelope used while the
 * revision runs against a controlled provider. Selecting and mapping the real
 * vendor's schema is Phase 10 work and is confined to this file.
 */
const providerEnvelopeSchema = z.object({
    output: z.unknown(),
    model: z.string().trim().min(1).optional(),
    requestId: z.string().trim().min(1).optional(),
})

export class HttpLlmClient implements LlmClientPort {
    private readonly provider: string
    private readonly endpoint: string
    private readonly apiKey: string
    private readonly model: string
    private readonly timeoutMs: number
    private readonly fetchImpl: LlmFetch
    private readonly now: () => Date

    constructor(options: HttpLlmClientOptions) {
        const endpoint = new URL(options.apiBaseUrl)

        if (!['http:', 'https:'].includes(endpoint.protocol)) {
            throw new TypeError('LLM API base URL must use http or https.')
        }

        if (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0) {
            throw new TypeError('LLM timeoutMs must be a positive integer.')
        }

        if (options.provider.trim() === '') {
            throw new TypeError('LLM provider must be non-empty.')
        }

        if (options.model.trim() === '') {
            throw new TypeError('LLM model must be non-empty.')
        }

        if (options.apiKey.trim() === '') {
            throw new TypeError('LLM API key must be non-empty.')
        }

        this.provider = options.provider.trim()
        this.endpoint = endpoint.toString()
        this.apiKey = options.apiKey
        this.model = options.model.trim()
        this.timeoutMs = options.timeoutMs
        this.fetchImpl = options.fetchImpl ?? fetch
        this.now = options.now ?? (() => new Date())
    }

    async complete(
        request: LlmCompletionRequest,
        context: GeneratorInvocationContext,
    ): Promise<LlmCompletionResponse> {
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
                    authorization: `Bearer ${this.apiKey}`,
                    accept: 'application/json',
                    'content-type': 'application/json',
                    'x-correlation-id': invocationContext.correlationId,
                    'idempotency-key': invocationContext.idempotencyKey,
                },
                body: JSON.stringify({
                    model: this.model,
                    promptVersion: request.promptVersion,
                    outputName: request.outputName,
                    instructions: request.instructions,
                    input: request.input,
                    maxOutputTokens: request.maxOutputTokens,
                }),
                signal: controller.signal,
            })

            if (timedOut) {
                throw this.createTimeoutError(request, invocationContext)
            }

            if (!response.ok) {
                throw this.createHttpError(
                    response.status,
                    request,
                    invocationContext,
                )
            }

            let body: unknown

            try {
                body = await response.json()
            } catch (error) {
                throw this.createError({
                    code: 'INVALID_RESPONSE',
                    request,
                    context: invocationContext,
                    message: 'The LLM provider returned invalid JSON.',
                    retryable: false,
                    cause: error,
                })
            }

            if (timedOut) {
                throw this.createTimeoutError(request, invocationContext)
            }

            const parsed = providerEnvelopeSchema.safeParse(body)

            if (!parsed.success) {
                throw this.createError({
                    code: 'INVALID_RESPONSE',
                    request,
                    context: invocationContext,
                    message:
                        'The LLM provider returned an unrecognized response envelope.',
                    retryable: false,
                    cause: parsed.error,
                })
            }

            return {
                output: parsed.data.output,
                metadata: {
                    provider: this.provider,
                    model: parsed.data.model ?? this.model,
                    promptVersion: request.promptVersion,
                    providerRequestId: parsed.data.requestId,
                    generatedAt: this.now().toISOString(),
                },
            }
        } catch (error) {
            if (error instanceof LlmError) {
                throw error
            }

            if (timedOut || isAbortError(error)) {
                throw this.createTimeoutError(
                    request,
                    invocationContext,
                    error,
                )
            }

            throw this.createError({
                code: 'UNAVAILABLE',
                request,
                context: invocationContext,
                message: 'The LLM provider is unavailable.',
                retryable: true,
                cause: error,
            })
        } finally {
            clearTimeout(timeout)
        }
    }

    private createHttpError(
        statusCode: number,
        request: LlmCompletionRequest,
        context: GeneratorInvocationContext,
    ): LlmError {
        const details = getHttpErrorDetails(statusCode)

        return this.createError({
            code: details.code,
            request,
            context,
            message: `The LLM provider request failed (${statusCode}).`,
            retryable: details.retryable,
            statusCode,
        })
    }

    private createTimeoutError(
        request: LlmCompletionRequest,
        context: GeneratorInvocationContext,
        cause?: unknown,
    ): LlmError {
        return this.createError({
            code: 'TIMEOUT',
            request,
            context,
            message: 'The LLM provider request timed out.',
            retryable: true,
            cause,
        })
    }

    private createError(props: {
        readonly code: LlmErrorCode
        readonly request: LlmCompletionRequest
        readonly context: GeneratorInvocationContext
        readonly message: string
        readonly retryable: boolean
        readonly statusCode?: number
        readonly cause?: unknown
    }): LlmError {
        return new LlmError({
            code: props.code,
            operation: props.request.operation,
            provider: this.provider,
            correlationId: props.context.correlationId,
            message: props.message,
            retryable: props.retryable,
            statusCode: props.statusCode,
            cause: props.cause,
        })
    }
}

function getHttpErrorDetails(statusCode: number): {
    readonly code: LlmErrorCode
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
