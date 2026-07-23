import { ZodError } from 'zod'
import { GeneratorServiceError } from '../../adapters/generators/generator-error.js'
import { DomainError } from '../../domain/errors/domain.error.js'
import { ProgressUnavailableError } from '../../domain/errors/progress-unavailable.error.js'
import { SummaryUnavailableError } from '../../domain/errors/summary-unavailable.error.js'

export interface MappedHttpError {
    readonly message: string
    readonly status: number
}

export function mapError(error: unknown): MappedHttpError {
    if (error instanceof ProgressUnavailableError) {
        return { message: 'progressUnavailable', status: 503 }
    }

    if (error instanceof SummaryUnavailableError) {
        return { message: 'summaryUnavailable', status: 404 }
    }

    if (error instanceof GeneratorServiceError) {
        return { message: 'summaryUnavailable', status: 503 }
    }

    if (error instanceof ZodError) {
        return { message: 'Invalid request.', status: 400 }
    }

    if (error instanceof DomainError) {
        return { message: error.message, status: 400 }
    }

    return { message: 'Something went wrong on the server.', status: 500 }
}
