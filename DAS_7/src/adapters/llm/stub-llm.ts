import type { LlmClient } from './llm-client.js';
import type { ProgressRecord, SkillArea, Student, Summary } from '../../types.js';
import { SKILL_AREAS } from '../../types.js';

/** One fixed piece of home advice per skill area — no randomness, no clock. */
const ADVICE: Record<SkillArea, string> = {
    'Phonological Awareness': 'Play rhyming and sound-swapping games together on the way to school.',
    'Reading Accuracy': 'Read a short passage aloud each evening and revisit any misread words gently.',
    'Reading Fluency': 'Re-read a favourite page two or three times so the words start to flow.',
    'Spelling': 'Practise spelling common words together for ten minutes a day.',
    'Writing': 'Ask for two sentences about the day, and praise the ideas before the spelling.',
    'Comprehension': 'After a story, ask what happened, why it happened, and what might happen next.',
};

/** Matches the '- <Skill Area>: <clause>' lines produced by generateSummary. */
const AREA_LINE = /^- ([^:]+): (.+)$/;

/**
 * Deterministic offline LlmClient: the same input always produces the same text,
 * so the demo reads plausibly and the unit tests can pin exact strings.
 * Neither method throws — failure modes are simulated with a different fake.
 */
export class StubLlmClient implements LlmClient {
    async generateSummary(input: { student: Student; records: ProgressRecord[] }): Promise<string> {
        const { student, records } = input;
        const lines = [`Here's how ${student.name} has been doing:`];

        for (const area of SKILL_AREAS) {
            // Records arrive date-ascending, so filtering keeps first = oldest, last = newest.
            const inArea = records.filter((r) => r.skillArea === area);
            if (inArea.length === 0) continue;

            const first = inArea[0].score;
            const last = inArea[inArea.length - 1].score;
            const trend = last > first
                ? `improved from ${first} to ${last}`
                : last < first
                    ? `dipped from ${first} to ${last}`
                    : `held steady at ${first}`;
            const sessions = inArea.length === 1 ? '1 session' : `${inArea.length} sessions`;

            lines.push(`- ${area}: ${trend} across ${sessions}.`);
        }

        return lines.join('\n');
    }

    async generateRecommendation(input: { student: Student; summary: Summary }): Promise<string> {
        const { student, summary } = input;
        const areas = weakestAreas(summary.content);

        return [
            `Ways you can support ${student.name} at home:`,
            ...areas.map((area) => ADVICE[area]),
        ].join('\n');
    }
}

/**
 * The two areas the student ended weakest in, read back off the summary we wrote.
 * Weakest first. Anything unparseable (a summary from a real provider, say) is
 * ignored, and the list is topped up from SKILL_AREAS so the caller always gets two.
 */
function weakestAreas(content: string): SkillArea[] {
    const scored: Array<{ area: SkillArea; score: number }> = [];

    for (const line of content.split('\n')) {
        const match = AREA_LINE.exec(line.trim());
        if (!match) continue;

        const area = SKILL_AREAS.find((a) => a === match[1]);
        if (!area || scored.some((s) => s.area === area)) continue;

        const score = latestScore(match[2]);
        if (score === null) continue;

        scored.push({ area, score });
    }

    // Stable sort: equal scores keep the order the areas appear in the summary.
    scored.sort((a, b) => a.score - b.score);

    const chosen = scored.slice(0, 2).map((s) => s.area);
    for (const area of SKILL_AREAS) {
        if (chosen.length === 2) break;
        if (!chosen.includes(area)) chosen.push(area);
    }

    return chosen;
}

/** The score the student ended on: the last number before the ' across N sessions' tail. */
function latestScore(clause: string): number | null {
    const numbers = clause.split(' across ')[0].match(/\d+/g);
    return numbers ? Number(numbers[numbers.length - 1]) : null;
}
