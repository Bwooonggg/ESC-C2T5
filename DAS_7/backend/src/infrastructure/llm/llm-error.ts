/** The DAS 7 operations that share the LLM client boundary. */
export type LlmOperation = 'summary' | 'recommendation'

/**
 * Provider-neutral failure categories. Vendor status codes, error bodies, and
 * SDK exceptions are translated into exactly these before leaving the
 * infrastructure boundary.
 */
export type LlmErrorCode =
    | 'INVALID_RESPONSE'
    | 'TIMEOUT'
    | 'AUTHENTICATION_FAILED'
    | 'RATE_LIMITED'
    | 'UNAVAILABLE'
    | 'REQUEST_FAILED'

export interface LlmErrorProps {
    readonly code: LlmErrorCode
    readonly operation: LlmOperation
    readonly provider: string
    readonly correlationId: string
    readonly message: string
    readonly retryable: boolean
    readonly statusCode?: number
    readonly cause?: unknown
}

export class LlmError extends Error {
    readonly code: LlmErrorCode
    readonly operation: LlmOperation
    readonly provider: string
    readonly correlationId: string
    readonly retryable: boolean
    readonly statusCode?: number

    constructor(props: LlmErrorProps) {
        super(props.message, { cause: props.cause })
        this.name = 'LlmError'
        this.code = props.code
        this.operation = props.operation
        this.provider = props.provider
        this.correlationId = props.correlationId
        this.retryable = props.retryable
        this.statusCode = props.statusCode
    }
}
