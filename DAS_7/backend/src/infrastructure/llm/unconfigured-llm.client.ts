import type { GeneratorInvocationContext } from '../../shared/generator-context.js'
import type {
    LlmClientPort,
    LlmCompletionRequest,
    LlmCompletionResponse,
} from './llm-client.port.js'
import { LlmError } from './llm-error.js'

/**
 * Used when no LLM provider is configured. It fails fast with the same
 * provider-neutral category the transport would use, so callers need no
 * separate "not configured" branch.
 */
export class UnconfiguredLlmClient implements LlmClientPort {
    async complete(
        request: LlmCompletionRequest,
        context: GeneratorInvocationContext,
    ): Promise<LlmCompletionResponse> {
        throw new LlmError({
            code: 'UNAVAILABLE',
            operation: request.operation,
            provider: 'unconfigured',
            correlationId: context.correlationId,
            message: 'No LLM provider is configured.',
            retryable: false,
        })
    }
}
