import type { Summary } from '../../../domain/entities/summary.js'

export interface RecommendationGenerationRequest {
    /**
     * The immutable, persisted summary that is the sole basis for the
     * recommendation. The application owns the summary/student relationship.
     */
    readonly summary: Summary
}

export interface RecommendationGenerationResult {
    /** Provider-generated recommendation content; the adapter validates it as non-empty. */
    readonly content: string
    /** Provider-specific data that is not part of the domain Recommendation entity. */
    readonly metadata?: Readonly<Record<string, unknown>>
}

export interface RecommendationGeneratorPort {
    generate(
        request: RecommendationGenerationRequest,
    ): Promise<RecommendationGenerationResult>
}
