import { createInsightService } from '../../src/services/insight.service.js';
import { LlmUnavailableError } from '../../src/adapters/llm/llm-client.js';
import type { LlmClient } from '../../src/adapters/llm/llm-client.js';
import type {
    ProgressRepo, RecommendationRepo, StudentRepo, SummaryRepo,
} from '../../src/deps.js';
import { NotFoundError, UnavailableError } from '../../src/errors.js';
import type { ApiError } from '../../src/errors.js';
import type { ProgressRecord, Recommendation, Student, Summary } from '../../src/types.js';

const STUDENT: Student = {
    studentId: 'stu-1',
    name: 'Amira',
    dateOfBirth: '2015-04-02',
    bandLevel: 'Band A',
};

const RECORDS: ProgressRecord[] = [
    {
        recordId: 'rec-1', studentId: STUDENT.studentId, date: '2026-01-05',
        skillArea: 'Spelling', score: 62, notes: 'settling in',
    },
    {
        recordId: 'rec-2', studentId: STUDENT.studentId, date: '2026-01-19',
        skillArea: 'Spelling', score: 71, notes: '',
    },
];

function storedSummary(over: Partial<Summary> = {}): Summary {
    return {
        summaryId: 'sum-existing',
        studentId: STUDENT.studentId,
        content: 'stored summary',
        generatedAt: '2026-02-01T00:00:00.000Z',
        ...over,
    };
}

/**
 * In-file fakes for the four repos and the llm — nothing from src/repos/ is imported,
 * so these suites run offline.
 */
function makeService(opts: {
    student?: Student | null;
    records?: ProgressRecord[];
    summaries?: Summary[];
    latestCreatedAt?: string | null;
    llmMode?: 'ok' | 'fail';
} = {}) {
    const student = opts.student === undefined ? STUDENT : opts.student;
    const records = opts.records ?? RECORDS;
    const summaries: Summary[] = [...(opts.summaries ?? [])];
    const recommendations: Recommendation[] = [];
    const calls = { generateSummary: 0, generateRecommendation: 0 };

    const studentRepo: StudentRepo = {
        byId: async (studentId) => (student && student.studentId === studentId ? student : null),
        listByParent: async () => (student ? [student] : []),
        isGuardian: async () => true,
    };

    const progressRepo: ProgressRepo = {
        listByStudent: async () => records,
        latestCreatedAt: async () => opts.latestCreatedAt ?? null,
    };

    const summaryRepo: SummaryRepo = {
        latestByStudent: async () => summaries.at(-1) ?? null,
        insert: async ({ studentId, content }) => {
            const row: Summary = {
                summaryId: `sum-${summaries.length + 1}`,
                studentId,
                content,
                generatedAt: `2026-03-0${summaries.length + 1}T00:00:00.000Z`,
            };
            summaries.push(row);
            return row;
        },
    };

    const recommendationRepo: RecommendationRepo = {
        insert: async ({ summaryId, content }) => {
            const row: Recommendation = {
                recommendationId: `rec-${recommendations.length + 1}`,
                summaryId,
                content,
                generatedAt: '2026-03-05T00:00:00.000Z',
            };
            recommendations.push(row);
            return row;
        },
    };

    const llm: LlmClient = {
        generateSummary: async () => {
            calls.generateSummary += 1;
            if (opts.llmMode === 'fail') throw new LlmUnavailableError();
            return 'generated summary';
        },
        generateRecommendation: async () => {
            calls.generateRecommendation += 1;
            if (opts.llmMode === 'fail') throw new LlmUnavailableError();
            return 'Ways you can help:\n- read together';
        },
    };

    const service = createInsightService({
        studentRepo, progressRepo, summaryRepo, recommendationRepo, llm,
    });

    return { service, summaries, recommendations, calls };
}

/** Asserts both the class and the wire-facing status/message of a thrown ApiError. */
async function expectApiError(
    promise: Promise<unknown>,
    type: new (...args: never[]) => ApiError,
    status: number,
    message: string,
): Promise<void> {
    await expect(promise).rejects.toBeInstanceOf(type);
    await expect(promise).rejects.toMatchObject({ status, message });
}

describe('InsightService.getSummary', () => {
    it('generates, stores and returns a summary when none exists', async () => {
        const { service, summaries, calls } = makeService();

        const summary = await service.getSummary(STUDENT.studentId);

        expect(summary.content).toBe('generated summary');
        expect(summary.studentId).toBe(STUDENT.studentId);
        expect(summaries).toHaveLength(1);
        expect(summaries[0].summaryId).toBe(summary.summaryId);
        expect(calls.generateSummary).toBe(1);
    });

    it('reuses a fresh summary without calling the llm', async () => {
        const existing = storedSummary({ generatedAt: '2026-02-10T00:00:00.000Z' });
        const { service, summaries, calls } = makeService({
            summaries: [existing],
            latestCreatedAt: '2026-02-01T00:00:00.000Z',
        });

        const summary = await service.getSummary(STUDENT.studentId);

        expect(summary).toEqual(existing);
        expect(summaries).toHaveLength(1);
        expect(calls.generateSummary).toBe(0);
    });

    it('reuses the stored summary when no progress insert timestamp is known', async () => {
        const { service, calls } = makeService({
            summaries: [storedSummary()],
            latestCreatedAt: null,
        });

        expect((await service.getSummary(STUDENT.studentId)).summaryId).toBe('sum-existing');
        expect(calls.generateSummary).toBe(0);
    });

    it('regenerates when progress arrived after the stored summary', async () => {
        const { service, summaries, calls } = makeService({
            summaries: [storedSummary({ generatedAt: '2026-02-01T00:00:00.000Z' })],
            latestCreatedAt: '2026-02-14T00:00:00.000Z',
        });

        const summary = await service.getSummary(STUDENT.studentId);

        expect(summary.content).toBe('generated summary');
        expect(summary.summaryId).not.toBe('sum-existing');
        expect(summaries).toHaveLength(2);
        expect(calls.generateSummary).toBe(1);
    });

    it('rejects an unknown student with 404 progressUnavailable', async () => {
        const { service, calls } = makeService({ student: null });

        await expectApiError(
            service.getSummary('nobody'), NotFoundError, 404, 'progressUnavailable',
        );
        expect(calls.generateSummary).toBe(0);
    });

    it('rejects a student with no progress with 503 progressUnavailable (IT7A-05)', async () => {
        const { service, summaries, calls } = makeService({ records: [] });

        await expectApiError(
            service.getSummary(STUDENT.studentId), UnavailableError, 503, 'progressUnavailable',
        );
        expect(calls.generateSummary).toBe(0);
        expect(summaries).toHaveLength(0);
    });

    it('maps an llm failure to 503 summaryUnavailable and stores nothing (IT7A-07)', async () => {
        const { service, summaries, calls } = makeService({ llmMode: 'fail' });

        await expectApiError(
            service.getSummary(STUDENT.studentId), UnavailableError, 503, 'summaryUnavailable',
        );
        expect(summaries).toHaveLength(0);
        expect(calls.generateSummary).toBeGreaterThan(0);
    });
});

describe('InsightService.trackProgress', () => {
    it('returns the progress records alongside the summary', async () => {
        const { service } = makeService();

        const result = await service.trackProgress(STUDENT.studentId);

        expect(result.progress).toEqual(RECORDS);
        expect(result.summary.content).toBe('generated summary');
    });

    it('propagates the no-progress failure', async () => {
        const { service } = makeService({ records: [] });

        await expectApiError(
            service.trackProgress(STUDENT.studentId),
            UnavailableError, 503, 'progressUnavailable',
        );
    });
});

describe('InsightService.createRecommendation', () => {
    it('generates from the latest stored summary and stores the result', async () => {
        const { service, recommendations, calls } = makeService({
            summaries: [storedSummary({ summaryId: 'sum-old' }), storedSummary({ summaryId: 'sum-new' })],
        });

        const recommendation = await service.createRecommendation(STUDENT.studentId);

        expect(recommendation.summaryId).toBe('sum-new');
        expect(recommendation.content).toContain('\n');
        expect(recommendations).toHaveLength(1);
        expect(calls.generateRecommendation).toBe(1);
        expect(calls.generateSummary).toBe(0);   // never triggers summary generation
    });

    it('rejects with 404 summaryUnavailable when no summary exists (IT7A-08)', async () => {
        const { service, recommendations, calls } = makeService();

        await expectApiError(
            service.createRecommendation(STUDENT.studentId),
            NotFoundError, 404, 'summaryUnavailable',
        );
        expect(recommendations).toHaveLength(0);
        expect(calls.generateSummary).toBe(0);
        expect(calls.generateRecommendation).toBe(0);
    });

    it('rejects an unknown student with 404 progressUnavailable', async () => {
        const { service } = makeService({ student: null, summaries: [storedSummary()] });

        await expectApiError(
            service.createRecommendation('nobody'), NotFoundError, 404, 'progressUnavailable',
        );
    });

    it('maps an llm failure to 503 recommendationUnavailable and stores nothing (IT7A-09)', async () => {
        const { service, recommendations } = makeService({
            summaries: [storedSummary()],
            llmMode: 'fail',
        });

        await expectApiError(
            service.createRecommendation(STUDENT.studentId),
            UnavailableError, 503, 'recommendationUnavailable',
        );
        expect(recommendations).toHaveLength(0);
    });
});
