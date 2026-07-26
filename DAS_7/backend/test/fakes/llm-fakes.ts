import type { GeneratorInvocationContext } from '../../src/shared/generator-context.js'
import type {
    LlmClientPort,
    LlmCompletionMetadata,
    LlmCompletionRequest,
    LlmCompletionResponse,
} from '../../src/infrastructure/llm/llm-client.port.js'

export interface LlmCompletionCall {
    readonly request: LlmCompletionRequest
    readonly context: GeneratorInvocationContext
}

/**
 * Stands in for the shared LLM transport so adapter tests can assert what is
 * sent across the boundary without a provider.
 */
export class FakeLlmClient implements LlmClientPort {
    readonly calls: LlmCompletionCall[] = []
    output: unknown = { summary: 'Fake summary' }
    metadata: LlmCompletionMetadata = {
        provider: 'test-provider',
        model: 'test-model',
        promptVersion: 'test-prompt-1',
        providerRequestId: 'provider-request-1',
        generatedAt: '2026-07-25T09:30:00.000Z',
    }
    error: unknown = null

    async complete(
        request: LlmCompletionRequest,
        context: GeneratorInvocationContext,
    ): Promise<LlmCompletionResponse> {
        this.calls.push({ request, context })

        if (this.error !== null) {
            throw this.error
        }

        return { output: this.output, metadata: this.metadata }
    }
}
