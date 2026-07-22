import type { Summary } from '../../../domain/entities/summary.js'

export interface RecommendationGenerationRequest {
    readonly summary: Summary
}

export interface RecommendationGenerationResult {
    readonly content: string
    readonly metadata?: Readonly<Record<string, unknown>>
}

export interface RecommendationGeneratorPort {
    generate(
        request: RecommendationGenerationRequest,
    ): Promise<RecommendationGenerationResult>
}
