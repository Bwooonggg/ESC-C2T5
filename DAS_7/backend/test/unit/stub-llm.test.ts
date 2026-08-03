import { StubLlmClient } from '../../src/adapters/llm/stub-llm.js';
import type { ProgressRecord, SkillArea, Student, Summary } from '../../src/types.js';

const STUDENT: Student = {
    studentId: 'stu-1',
    name: 'Amira',
    dateOfBirth: '2015-04-02',
    bandLevel: 'Band A',
};

let nextRecord = 0;

/** Progress records are handed to the client date-ascending, as the repo returns them. */
function record(skillArea: SkillArea, date: string, score: number): ProgressRecord {
    nextRecord += 1;
    return {
        recordId: `rec-${nextRecord}`,
        studentId: STUDENT.studentId,
        date,
        skillArea,
        score,
        notes: '',
    };
}

function summary(content: string): Summary {
    return {
        summaryId: 'sum-1',
        studentId: STUDENT.studentId,
        content,
        generatedAt: '2026-03-01T09:00:00.000Z',
    };
}

// Two areas, deliberately interleaved and in the opposite order to SKILL_AREAS,
// so the pinned output proves both the grouping and the ordering.
const TWO_AREAS: ProgressRecord[] = [
    record('Spelling', '2026-01-05', 70),
    record('Reading Accuracy', '2026-01-06', 62),
    record('Reading Accuracy', '2026-01-13', 71),
    record('Spelling', '2026-01-19', 55),
    record('Reading Accuracy', '2026-01-20', 78),
];

const TWO_AREA_SUMMARY = [
    "Here's how Amira has been doing:",
    '- Reading Accuracy: improved from 62 to 78 across 3 sessions.',
    '- Spelling: dipped from 70 to 55 across 2 sessions.',
].join('\n');

describe('StubLlmClient.generateSummary', () => {
    const llm = new StubLlmClient();

    it('renders one line per skill area, in SKILL_AREAS order', async () => {
        const content = await llm.generateSummary({ student: STUDENT, records: TWO_AREAS });

        expect(content).toBe(TWO_AREA_SUMMARY);
    });

    it('reports an unchanged area as held steady, and a lone record as one session', async () => {
        const content = await llm.generateSummary({
            student: STUDENT,
            records: [
                record('Phonological Awareness', '2026-01-05', 44),
                record('Writing', '2026-01-06', 30),
                record('Writing', '2026-01-13', 30),
            ],
        });

        expect(content).toBe([
            "Here's how Amira has been doing:",
            '- Phonological Awareness: held steady at 44 across 1 session.',
            '- Writing: held steady at 30 across 2 sessions.',
        ].join('\n'));
    });

    it('is deterministic — the same input yields identical output', async () => {
        const first = await llm.generateSummary({ student: STUDENT, records: TWO_AREAS });
        const second = await llm.generateSummary({ student: STUDENT, records: TWO_AREAS });

        expect(second).toBe(first);
    });

    it('returns just the header when there are no records', async () => {
        const content = await llm.generateSummary({ student: STUDENT, records: [] });

        expect(content).toBe("Here's how Amira has been doing:");
    });
});

describe('StubLlmClient.generateRecommendation', () => {
    const llm = new StubLlmClient();

    it('advises on the two areas with the lowest latest scores, weakest first', async () => {
        const content = await llm.generateRecommendation({
            student: STUDENT,
            summary: summary([
                "Here's how Amira has been doing:",
                '- Reading Accuracy: improved from 62 to 78 across 3 sessions.',
                '- Spelling: dipped from 70 to 55 across 2 sessions.',
                '- Writing: held steady at 40 across 4 sessions.',
            ].join('\n')),
        });
        const lines = content.split('\n');

        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe('Ways you can support Amira at home:');
        expect(lines[1]).toContain('two sentences about the day');   // Writing, latest 40
        expect(lines[2]).toContain('spelling common words');         // Spelling, latest 55
    });

    it('reads the ending score, not the session count', async () => {
        // Spelling ends on 90 with 3 sessions; a naive "last number" read would
        // rank it below Writing's 40 and pick the wrong two areas.
        const content = await llm.generateRecommendation({
            student: STUDENT,
            summary: summary([
                "Here's how Amira has been doing:",
                '- Spelling: improved from 51 to 90 across 3 sessions.',
                '- Writing: dipped from 66 to 40 across 2 sessions.',
                '- Comprehension: held steady at 47 across 5 sessions.',
            ].join('\n')),
        });

        expect(content.split('\n').slice(1)).toEqual([
            'Ask for two sentences about the day, and praise the ideas before the spelling.',
            'After a story, ask what happened, why it happened, and what might happen next.',
        ]);
    });

    it('falls back to the first two skill areas on foreign summary content', async () => {
        const content = await llm.generateRecommendation({
            student: STUDENT,
            summary: summary('Amira is making steady progress and enjoys reading aloud.'),
        });

        expect(content.split('\n')).toEqual([
            'Ways you can support Amira at home:',
            'Play rhyming and sound-swapping games together on the way to school.',
            'Read a short passage aloud each evening and revisit any misread words gently.',
        ]);
    });

    it('tops up to two lines when the summary names only one area', async () => {
        const content = await llm.generateRecommendation({
            student: STUDENT,
            summary: summary([
                "Here's how Amira has been doing:",
                '- Writing: held steady at 40 across 4 sessions.',
            ].join('\n')),
        });
        const lines = content.split('\n');

        expect(lines).toHaveLength(3);
        expect(lines[1]).toContain('two sentences about the day');   // the named area
        expect(lines[2]).toContain('rhyming and sound-swapping');    // first unused area
    });

    it('is deterministic — the same summary yields identical advice', async () => {
        const input = { student: STUDENT, summary: summary(TWO_AREA_SUMMARY) };

        expect(await llm.generateRecommendation(input))
            .toBe(await llm.generateRecommendation(input));
    });
});
