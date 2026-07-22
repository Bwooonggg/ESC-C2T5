import type { ProgressRecord } from '../../../domain/entities/progress-record.js'
import type { Student } from '../../../domain/entities/student.js'

export interface SummaryGenerationRequest {
    readonly student: Student
    readonly records: readonly ProgressRecord[]
}

export interface SummaryGenerationResult {
    readonly content: string
    readonly metadata?: Readonly<Record<string, unknown>>
}

export interface SummaryGeneratorPort {
    generate(
        request: SummaryGenerationRequest,
    ): Promise<SummaryGenerationResult>
}
