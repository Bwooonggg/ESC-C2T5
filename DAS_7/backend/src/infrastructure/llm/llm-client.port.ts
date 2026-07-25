import type { GeneratorInvocationContext } from '../../shared/generator-context.js'
import type { LlmOperation } from './llm-error.js'

/**
 * A provider-neutral structured completion request. It carries a rendered
 * prompt and the name of the output contract the caller will validate; it
 * carries no vendor request fields, credentials, or transport details.
 */
export interface LlmCompletionRequest {
    /** The DAS 7 operation asking for the completion. */
    readonly operation: LlmOperation
    /** Stable identifier of the prompt template that produced this request. */
    readonly promptVersion: string
    /** Role and task instructions. */
    readonly instructions: string
    /** The rendered task input. */
    readonly input: string
    /** Name of the structured output contract the caller validates. */
    readonly outputName: string
    /** Upper bound the transport may translate to a vendor-specific option. */
    readonly maxOutputTokens?: number
}

/**
 * Generation provenance sufficient for support and reproducibility. It is
 * deliberately small: no API keys and no raw provider payloads.
 */
export interface LlmCompletionMetadata {
    readonly provider: string
    readonly model: string
    readonly promptVersion: string
    readonly providerRequestId?: string
    /** ISO-8601 timestamp of the completion. */
    readonly generatedAt: string
}

export interface LlmCompletionResponse {
    /** The parsed structured payload. The caller validates its shape. */
    readonly output: unknown
    readonly metadata: LlmCompletionMetadata
}

/**
 * The single seam both generator adapters share. Summary and recommendation
 * remain peer application contracts; only their transport is shared.
 */
export interface LlmClientPort {
    complete(
        request: LlmCompletionRequest,
        context: GeneratorInvocationContext,
    ): Promise<LlmCompletionResponse>
}
