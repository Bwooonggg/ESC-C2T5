import { LlmUnavailableError, type LlmClient } from './llm-client.js';
import type { ProgressRecord, Student, Summary } from '../../types.js';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/** Caps: a runaway model must not blow up an email or a dashboard panel. */
const MAX_SUMMARY_CHARS = 2000;
const MAX_RECOMMENDATION_LINES = 5;

const SUMMARY_SYSTEM = [
    'You write for parents of children with dyslexia at the Dyslexia Association of Singapore.',
    'Use warm, plain English a non-specialist can follow. No jargon, no markdown, no bullet',
    'points, no headings. Never diagnose, never give medical advice, and never invent scores',
    'that are not in the data. Refer to the child by first name.',
].join(' ');

const RECOMMENDATION_SYSTEM = [
    'You suggest practical things a parent can do at home to support a child with dyslexia.',
    'Output one suggestion per line. No numbering, no bullet characters, no markdown, no',
    'preamble. Each line under 25 words. Never give medical advice.',
].join(' ');

/**
 * OpenRouter-backed LlmClient: one `fetch` per generation, no SDK and no retries.
 * OpenRouter speaks the OpenAI chat-completions dialect, so one adapter reaches
 * every model it fronts — switching model is an env change, not a code change.
 *
 * Every failure mode (unreachable, non-2xx, timeout, malformed or empty output)
 * becomes an LlmUnavailableError, which the insight service maps to a 503 with
 * nothing persisted. The API key never appears in a thrown message.
 */
export function createOpenRouterLlmClient(
    config: { apiKey: string; model: string; timeoutMs: number },
): LlmClient {
    async function generate(system: string, user: string): Promise<string> {
        let response: Response;
        try {
            response = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    // Optional attribution headers OpenRouter shows in its dashboard.
                    'X-Title': 'DAS Parent Insight Dashboard',
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: user },
                    ],
                    temperature: 0.4,
                    max_tokens: 600,
                }),
                signal: AbortSignal.timeout(config.timeoutMs),
            });
        } catch (err) {
            const reason = err instanceof Error && err.name === 'TimeoutError'
                ? `timed out after ${config.timeoutMs}ms`
                : err instanceof Error ? err.message : String(err);
            throw new LlmUnavailableError(`openrouter request failed: ${reason}`);
        }

        if (!response.ok) {
            throw new LlmUnavailableError(`openrouter responded ${response.status}`);
        }

        const body = await response.json().catch(() => null) as
            { choices?: Array<{ message?: { content?: string } }> } | null;
        const text = body?.choices?.[0]?.message?.content?.trim();
        if (!text) throw new LlmUnavailableError('openrouter returned no usable text');

        return text;
    }

    return {
        async generateSummary(input: { student: Student; records: ProgressRecord[] }): Promise<string> {
            const { student, records } = input;
            const rows = records
                .map((r) => `${r.date} | ${r.skillArea} | ${r.score}/100 | ${r.notes}`)
                .join('\n');

            const text = await generate(
                SUMMARY_SYSTEM,
                `Write 3 to 5 short sentences about how ${student.name} is progressing.\n\n`
                + `Assessment records (date | skill area | score | teacher notes):\n${rows}`,
            );

            return text.slice(0, MAX_SUMMARY_CHARS);
        },

        async generateRecommendation(input: { student: Student; summary: Summary }): Promise<string> {
            const { student, summary } = input;

            const text = await generate(
                RECOMMENDATION_SYSTEM,
                `Suggest 3 things a parent can do at home to support ${student.name}, based on `
                + `this progress summary.\n\nSummary:\n${summary.content}`,
            );

            // The contract is '\n'-joined lines; strip stray bullets or numbering a model
            // may add despite the instruction, and drop blank lines.
            const lines = text
                .split('\n')
                .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
                .filter((line) => line.length > 0)
                .slice(0, MAX_RECOMMENDATION_LINES);

            if (lines.length === 0) throw new LlmUnavailableError('openrouter returned no advice lines');

            return lines.join('\n');
        },
    };
}
