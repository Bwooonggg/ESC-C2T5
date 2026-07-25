import type { RecommendationGenerationRequest } from '../../../modules/track-progress/ports/recommendation-generator.js'

export const RECOMMENDATION_PROMPT_VERSION = 'recommendation-2026-07-1'
export const RECOMMENDATION_OUTPUT_NAME = 'student_recommendation'

const INSTRUCTIONS = [
    'You suggest home learning activities for a primary-school parent.',
    'Use only the progress summary provided as the basis. Do not invent',
    'scores, diagnoses, or comparisons with other students.',
    'Write two to four plain-language sentences describing practical steps a',
    'parent can take in the coming weeks.',
    `Reply with JSON matching {"recommendation": string}.`,
].join(' ')

/**
 * Builds the recommendation prompt from exactly the persisted basis summary.
 * Identifiers and parent contact details are not sent.
 */
export function buildRecommendationPrompt(
    request: RecommendationGenerationRequest,
): {
    readonly instructions: string
    readonly input: string
} {
    const input = JSON.stringify({
        summary: request.summary.content,
    })

    return { instructions: INSTRUCTIONS, input }
}
