import type { Student, ProgressRecord, Summary } from '../../types.js';

/** Thrown for ANY llm failure mode: unreachable, timeout, malformed output. */
export class LlmUnavailableError extends Error {
    constructor(message = 'llm unavailable') { super(message); this.name = 'LlmUnavailableError'; }
}

export interface LlmClient {
    generateSummary(input: { student: Student; records: ProgressRecord[] }): Promise<string>;
    /** Returns '\n'-joined suggestion lines. */
    generateRecommendation(input: { student: Student; summary: Summary }): Promise<string>;
}
