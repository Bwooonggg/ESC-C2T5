import type { GeneratorClient } from './generator.adapter.js'

export interface RecommendationGeneratorClientSummary {
    readonly summaryId: string
    readonly studentId: string
    readonly content: string
    readonly generatedAt: string
    readonly sourceProgressVersion: string
}

export interface RecommendationGeneratorClientRequest {
    readonly summary: RecommendationGeneratorClientSummary
}

export interface RecommendationGeneratorClient
    extends GeneratorClient<RecommendationGeneratorClientRequest> {}
