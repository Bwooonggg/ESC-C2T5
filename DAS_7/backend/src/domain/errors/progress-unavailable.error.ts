import { DomainError } from './domain.error.js'

export class ProgressUnavailableError extends DomainError {
    constructor(message = 'Progress is unavailable.') {
        super('PROGRESS_UNAVAILABLE', message)
    }
}
