import { HttpLlmClient, type LlmFetch } from './http-llm.client.js'
import type { LlmClientPort } from './llm-client.port.js'
import { UnconfiguredLlmClient } from './unconfigured-llm.client.js'

/**
 * Structurally matches AppConfig['llm'] so composition roots can pass their
 * settings without infrastructure depending on the configuration module.
 */
export interface LlmProviderSettings {
    readonly provider?: string
    readonly apiBaseUrl?: string
    readonly apiKey?: string
    readonly model?: string
    readonly timeoutMs: number
}

/**
 * Builds the one shared LLM client. Provider selection stays here at
 * composition time; no application or domain code sees the vendor.
 */
export function createLlmClient(
    settings: LlmProviderSettings,
    fetchImpl?: LlmFetch,
): LlmClientPort {
    const { provider, apiBaseUrl, apiKey, model } = settings

    if (!provider || !apiBaseUrl || !apiKey || !model) {
        return new UnconfiguredLlmClient()
    }

    return new HttpLlmClient({
        provider,
        apiBaseUrl,
        apiKey,
        model,
        timeoutMs: settings.timeoutMs,
        fetchImpl,
    })
}
