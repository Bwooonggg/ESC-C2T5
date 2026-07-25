import type {
    RecommendationGenerationRequest,
    RecommendationGenerationResult,
    RecommendationGeneratorPort,
} from '../../modules/track-progress/ports/recommendation-generator.js'
import {
    createGeneratorInvocationContext,
    normalizeGeneratorInvocationContext,
    type GeneratorInvocationContext,
} from '../../shared/generator-context.js'
import type { LlmClientPort } from './llm-client.port.js'
import { LlmError } from './llm-error.js'
import {
    buildRecommendationPrompt,
    RECOMMENDATION_OUTPUT_NAME,
    RECOMMENDATION_PROMPT_VERSION,
} from './prompts/recommendation.prompt.js'
import { recommendationOutputSchema } from './schemas/recommendation-output.schema.js'

/**
 * Realizes RecommendationGeneratorPort over the shared LLM client. It owns the
 * recommendation prompt and the recommendation output schema; it does not
 * build on the summary adapter.
 */
export class RecommendationGeneratorAdapter
    implements RecommendationGeneratorPort
{
    constructor(private readonly llmClient: LlmClientPort) {}

    async generate(
        request: RecommendationGenerationRequest,
        context?: GeneratorInvocationContext,
    ): Promise<RecommendationGenerationResult> {
        const invocationContext = normalizeGeneratorInvocationContext(
            context ?? createGeneratorInvocationContext(),
        )
        const prompt = buildRecommendationPrompt(request)
        const response = await this.llmClient.complete(
            {
                operation: 'recommendation',
                promptVersion: RECOMMENDATION_PROMPT_VERSION,
                outputName: RECOMMENDATION_OUTPUT_NAME,
                instructions: prompt.instructions,
                input: prompt.input,
            },
            invocationContext,
        )
        const parsed = recommendationOutputSchema.safeParse(response.output)

        if (!parsed.success) {
            throw new LlmError({
                code: 'INVALID_RESPONSE',
                operation: 'recommendation',
                provider: response.metadata.provider,
                correlationId: invocationContext.correlationId,
                message:
                    'The LLM provider returned an invalid recommendation.',
                retryable: false,
                cause: parsed.error,
            })
        }

        return {
            content: parsed.data.recommendation,
            metadata: { ...response.metadata },
        }
    }
}
