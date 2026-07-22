export type DomainErrorCode =
    | 'VALIDATION_ERROR'
    | 'PROGRESS_UNAVAILABLE'
    | 'SUMMARY_UNAVAILABLE'

export class DomainError extends Error {
    readonly code: DomainErrorCode

    constructor(code: DomainErrorCode, message: string) {
        super(message)
        this.name = new.target.name
        this.code = code
    }
}

export class ValidationError extends DomainError {
    constructor(message: string) {
        super('VALIDATION_ERROR', message)
    }
}
