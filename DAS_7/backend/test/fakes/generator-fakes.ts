import {
    createGeneratorInvocationContext,
    type GeneratorInvocationContext,
} from '../../src/shared/generator-context.js'
import type {
    RecommendationGenerationRequest,
    RecommendationGenerationResult,
    RecommendationGeneratorPort,
} from '../../src/modules/track-progress/ports/recommendation-generator.js'
import type {
    SummaryGenerationRequest,
    SummaryGenerationResult,
    SummaryGeneratorPort,
} from '../../src/modules/track-progress/ports/summary-generator.js'

export interface SummaryGenerationCall {
    readonly request: SummaryGenerationRequest
    readonly context: GeneratorInvocationContext
}

export class FakeSummaryGenerator implements SummaryGeneratorPort {
    readonly calls: SummaryGenerationCall[] = []
    result: SummaryGenerationResult = { content: 'Fake summary' }
    error: unknown = null

    async generate(
        request: SummaryGenerationRequest,
        context?: GeneratorInvocationContext,
    ): Promise<SummaryGenerationResult> {
        const invocationContext =
            context ?? createGeneratorInvocationContext()
        this.calls.push({ request, context: invocationContext })

        if (this.error !== null) {
            throw this.error
        }

        return this.result
    }
}

export interface RecommendationGenerationCall {
    readonly request: RecommendationGenerationRequest
    readonly context: GeneratorInvocationContext
}

export class FakeRecommendationGenerator
    implements RecommendationGeneratorPort
{
    readonly calls: RecommendationGenerationCall[] = []
    result: RecommendationGenerationResult = {
        content: 'Fake recommendation',
    }
    error: unknown = null

    async generate(
        request: RecommendationGenerationRequest,
        context?: GeneratorInvocationContext,
    ): Promise<RecommendationGenerationResult> {
        const invocationContext =
            context ?? createGeneratorInvocationContext()
        this.calls.push({ request, context: invocationContext })

        if (this.error !== null) {
            throw this.error
        }

        return this.result
    }
}
