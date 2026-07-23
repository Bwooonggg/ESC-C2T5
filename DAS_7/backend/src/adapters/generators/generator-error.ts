export type GeneratorErrorCode =
    | 'INVALID_RESPONSE'
    | 'TIMEOUT'
    | 'AUTHENTICATION_FAILED'
    | 'RATE_LIMITED'
    | 'UNAVAILABLE'
    | 'REQUEST_FAILED'

export interface GeneratorServiceErrorProps {
    readonly code: GeneratorErrorCode
    readonly serviceName: string
    readonly correlationId: string
    readonly message: string
    readonly retryable: boolean
    readonly statusCode?: number
    readonly cause?: unknown
}

export class GeneratorServiceError extends Error {
    readonly code: GeneratorErrorCode
    readonly serviceName: string
    readonly correlationId: string
    readonly retryable: boolean
    readonly statusCode?: number

    constructor(props: GeneratorServiceErrorProps) {
        super(props.message, { cause: props.cause })
        this.name = 'GeneratorServiceError'
        this.code = props.code
        this.serviceName = props.serviceName
        this.correlationId = props.correlationId
        this.retryable = props.retryable
        this.statusCode = props.statusCode
    }
}
