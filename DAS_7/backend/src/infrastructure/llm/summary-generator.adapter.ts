import type {
    SummaryGenerationRequest,
    SummaryGenerationResult,
    SummaryGeneratorPort,
} from '../../modules/summaries/ports/summary-generator.js'
import {
    createGeneratorInvocationContext,
    normalizeGeneratorInvocationContext,
    type GeneratorInvocationContext,
} from '../../shared/generator-context.js'
import type { LlmClientPort } from './llm-client.port.js'
import { LlmError } from './llm-error.js'
import {
    buildSummaryPrompt,
    SUMMARY_OUTPUT_NAME,
    SUMMARY_PROMPT_VERSION,
} from './prompts/summary.prompt.js'
import { summaryOutputSchema } from './schemas/summary-output.schema.js'

/**
 * Realizes SummaryGeneratorPort over the shared LLM client. It owns the
 * summary prompt and the summary output schema; it does not build on the
 * recommendation adapter.
 */
export class SummaryGeneratorAdapter implements SummaryGeneratorPort {
    constructor(private readonly llmClient: LlmClientPort) {}

    async generate(
        request: SummaryGenerationRequest,
        context?: GeneratorInvocationContext,
    ): Promise<SummaryGenerationResult> {
        const invocationContext = normalizeGeneratorInvocationContext(
            context ?? createGeneratorInvocationContext(),
        )
        const prompt = buildSummaryPrompt(request)
        const response = await this.llmClient.complete(
            {
                operation: 'summary',
                promptVersion: SUMMARY_PROMPT_VERSION,
                outputName: SUMMARY_OUTPUT_NAME,
                instructions: prompt.instructions,
                input: prompt.input,
            },
            invocationContext,
        )
        const parsed = summaryOutputSchema.safeParse(response.output)

        if (!parsed.success) {
            throw new LlmError({
                code: 'INVALID_RESPONSE',
                operation: 'summary',
                provider: response.metadata.provider,
                correlationId: invocationContext.correlationId,
                message: 'The LLM provider returned an invalid summary.',
                retryable: false,
                cause: parsed.error,
            })
        }

        return {
            content: parsed.data.summary,
            metadata: { ...response.metadata },
        }
    }
}
