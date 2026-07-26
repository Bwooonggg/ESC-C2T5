import type { SummaryGenerationRequest } from '../../../modules/summaries/ports/summary-generator.js'

export const SUMMARY_PROMPT_VERSION = 'summary-2026-07-1'
export const SUMMARY_OUTPUT_NAME = 'student_progress_summary'

const INSTRUCTIONS = [
    'You write short progress summaries for a primary-school parent.',
    'Use only the assessment records provided. Do not invent scores, dates,',
    'diagnoses, or comparisons with other students.',
    'Write two to four plain-language sentences covering overall standing,',
    'the clearest strength, and the clearest area to work on.',
    `Reply with JSON matching {"summary": string}.`,
].join(' ')

/**
 * Builds the summary prompt. Only the progress data needed for this operation
 * is sent: no parent contact details, no authentication claims, and no
 * identifiers or date of birth that the summary does not require.
 */
export function buildSummaryPrompt(request: SummaryGenerationRequest): {
    readonly instructions: string
    readonly input: string
} {
    const input = JSON.stringify({
        student: {
            name: request.student.name,
            bandLevel: request.student.bandLevel,
        },
        records: request.records.map((record) => ({
            date: toDateOnly(record.date),
            skillArea: record.skillArea.value,
            score: record.score,
            notes: record.notes,
        })),
    })

    return { instructions: INSTRUCTIONS, input }
}

function toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10)
}
