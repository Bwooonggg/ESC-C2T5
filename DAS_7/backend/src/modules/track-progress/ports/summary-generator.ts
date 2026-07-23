import type { ProgressRecord } from '../../../domain/entities/progress-record.js'
import type { Student } from '../../../domain/entities/student.js'
import type { GeneratorInvocationContext } from '../../../shared/generator-context.js'

export interface SummaryGenerationRequest {
    /**
     * The student and records must represent one progress snapshot. The
     * student's currentProgressVersion becomes Summary.sourceProgressVersion
     * after the application revalidates it before persistence.
     */
    readonly student: Student
    /**
     * Records are ordered by assessment date and then record ID. An empty
     * collection is a valid transport shape, but the application should
     * report unavailable progress instead of calling the generator for it.
     */
    readonly records: readonly ProgressRecord[]
}

export interface SummaryGenerationResult {
    /** Provider-generated summary content; the external boundary validates it. */
    readonly content: string
    /** Provider-specific data that is not part of the domain Summary entity. */
    readonly metadata?: Readonly<Record<string, unknown>>
}

export interface SummaryGeneratorPort {
    generate(
        request: SummaryGenerationRequest,
        context?: GeneratorInvocationContext,
    ): Promise<SummaryGenerationResult>
}
