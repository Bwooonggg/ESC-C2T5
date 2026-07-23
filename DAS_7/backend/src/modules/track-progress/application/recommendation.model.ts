import { randomUUID } from 'node:crypto'
import { Recommendation } from '../../../domain/entities/recommendation.js'
import { SummaryUnavailableError } from '../../../domain/errors/summary-unavailable.error.js'
import type { GeneratorInvocationContext } from '../../../shared/generator-context.js'
import { createGeneratorInvocationContext } from '../../../shared/generator-context.js'
import type { RecommendationGeneratorPort } from '../ports/recommendation-generator.js'
import type { RecommendationRepository } from '../ports/recommendation.repository.js'
import type { SummaryRepository } from '../ports/summary.repository.js'

export interface RecommendationModelDependencies {
    readonly summaryRepository: SummaryRepository
    readonly recommendationRepository: RecommendationRepository
    readonly recommendationGenerator: RecommendationGeneratorPort
    readonly now?: () => Date
    readonly createId?: () => string
}

export class RecommendationModel {
    private readonly summaryRepository: SummaryRepository
    private readonly recommendationRepository: RecommendationRepository
    private readonly recommendationGenerator: RecommendationGeneratorPort
    private readonly now: () => Date
    private readonly createId: () => string

    constructor(dependencies: RecommendationModelDependencies) {
        this.summaryRepository = dependencies.summaryRepository
        this.recommendationRepository = dependencies.recommendationRepository
        this.recommendationGenerator = dependencies.recommendationGenerator
        this.now = dependencies.now ?? (() => new Date())
        this.createId = dependencies.createId ?? randomUUID
    }

    async requestRecommendations(
        studentId: string,
        context?: GeneratorInvocationContext,
    ): Promise<Recommendation> {
        const summary =
            await this.summaryRepository.findLatestByStudentId(studentId)

        if (!summary || summary.studentId !== studentId) {
            throw new SummaryUnavailableError()
        }

        const generated = await this.recommendationGenerator.generate(
            { summary },
            context ?? createGeneratorInvocationContext(),
        )

        const recommendation = new Recommendation({
            recommendationId: this.createId(),
            studentId,
            summaryId: summary.summaryId,
            content: generated.content,
            generatedAt: this.now(),
        })

        await this.recommendationRepository.save(recommendation)

        return recommendation
    }
}
