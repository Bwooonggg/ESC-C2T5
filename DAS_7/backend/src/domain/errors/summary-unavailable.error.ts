import { DomainError } from './domain.error.js'

export class SummaryUnavailableError extends DomainError {
    constructor(message = 'Summary is unavailable.') {
        super('SUMMARY_UNAVAILABLE', message)
    }
}
