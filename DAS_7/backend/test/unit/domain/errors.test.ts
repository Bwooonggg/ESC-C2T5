import { describe, expect, it } from '@jest/globals'
import {
    DomainError,
    ValidationError,
} from '../../../src/domain/errors/domain.error.js'
import { ProgressUnavailableError } from '../../../src/domain/errors/progress-unavailable.error.js'
import { SummaryUnavailableError } from '../../../src/domain/errors/summary-unavailable.error.js'

describe('domain errors', () => {
    it('provides a stable validation error code', () => {
        const error = new ValidationError('Invalid value.')

        expect(error).toBeInstanceOf(DomainError)
        expect(error.name).toBe('ValidationError')
        expect(error.code).toBe('VALIDATION_ERROR')
        expect(error.message).toBe('Invalid value.')
    })

    it('provides a stable progress-unavailable error code', () => {
        const error = new ProgressUnavailableError()

        expect(error).toBeInstanceOf(DomainError)
        expect(error.name).toBe('ProgressUnavailableError')
        expect(error.code).toBe('PROGRESS_UNAVAILABLE')
        expect(error.message).toBe('Progress is unavailable.')
    })

    it('provides a stable summary-unavailable error code', () => {
        const error = new SummaryUnavailableError()

        expect(error).toBeInstanceOf(DomainError)
        expect(error.name).toBe('SummaryUnavailableError')
        expect(error.code).toBe('SUMMARY_UNAVAILABLE')
        expect(error.message).toBe('Summary is unavailable.')
    })
})
