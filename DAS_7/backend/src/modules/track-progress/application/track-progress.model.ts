import {
    GenerateStudentSummary,
    type GenerateStudentSummaryDependencies,
    type StudentSummarySnapshot,
} from '../../summaries/application/generate-student-summary.js'
import type { GeneratorInvocationContext } from '../../../shared/generator-context.js'

/**
 * The Track Child's Progress response data. It is the shared summary snapshot;
 * the alias is kept so existing controllers and contracts stay unchanged.
 */
export type TrackProgressResult = StudentSummarySnapshot

export interface ComposedTrackProgressDependencies {
    readonly generateStudentSummary: GenerateStudentSummary
}

/**
 * Either an already-composed capability, which is what the API and worker
 * containers pass, or the capability's own dependencies, which the model then
 * composes for callers that build the graph inline.
 */
export type TrackProgressModelDependencies =
    | ComposedTrackProgressDependencies
    | GenerateStudentSummaryDependencies

/**
 * Track Child's Progress use case. Snapshot reading, version revalidation,
 * generation, persistence, and coalescing belong to GenerateStudentSummary so
 * the notification worker can reuse exactly the same behavior.
 */
export class TrackProgressModel {
    private readonly generateStudentSummary: GenerateStudentSummary

    constructor(dependencies: TrackProgressModelDependencies) {
        this.generateStudentSummary = isComposed(dependencies)
            ? dependencies.generateStudentSummary
            : new GenerateStudentSummary(dependencies)
    }

    async trackProgress(
        studentId: string,
        context?: GeneratorInvocationContext,
    ): Promise<TrackProgressResult> {
        return this.generateStudentSummary.execute(studentId, context)
    }
}

function isComposed(
    dependencies: TrackProgressModelDependencies,
): dependencies is ComposedTrackProgressDependencies {
    return 'generateStudentSummary' in dependencies
}
