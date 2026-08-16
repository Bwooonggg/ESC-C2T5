import { createHarness, describeIntegration, type TestHarness } from '../helpers/harness.js';

describeIntegration('Level 2 insight service cluster', () => {
    let h: TestHarness;

    beforeAll(async () => {
        h = await createHarness();
    });

    beforeEach(() => {
        h.llm.reset();
    });

    afterAll(async () => {
        await h?.cleanup();
    });

    it('IT7A-S01 generates and stores a missing progress summary', async () => {
        const result = await h.deps.insightService.trackProgress(h.studentA1.studentId);

        expect(result.progress).not.toHaveLength(0);
        expect(result.progress.map(record => record.date)).toEqual(
            [...result.progress.map(record => record.date)].sort(),
        );
        expect(result.summary.content).not.toHaveLength(0);
        expect(h.llm.summaryCalls).toBe(1);
        await expect(h.deps.summaryRepo.latestByStudent(h.studentA1.studentId))
            .resolves.toEqual(result.summary);
    });

    it('IT7A-S02 reuses a current stored summary', async () => {
        const existing = await h.deps.summaryRepo.latestByStudent(h.studentA1.studentId);
        expect(existing).not.toBeNull();

        const result = await h.deps.insightService.trackProgress(h.studentA1.studentId);

        expect(result.summary.summaryId).toBe(existing?.summaryId);
        expect(h.llm.summaryCalls).toBe(0);
        const rows = await h.db
            .from('summaries')
            .select('summary_id', { count: 'exact' })
            .eq('student_id', h.studentA1.studentId);
        expect(rows.error).toBeNull();
        expect(rows.count).toBe(1);
    });

    it('IT7A-S03 creates a persisted recommendation from the latest summary', async () => {
        const latest = await h.deps.summaryRepo.latestByStudent(h.studentA1.studentId);
        expect(latest).not.toBeNull();

        const recommendation = await h.deps.insightService
            .createRecommendation(h.studentA1.studentId);

        expect(recommendation.summaryId).toBe(latest?.summaryId);
        expect(recommendation.content).not.toHaveLength(0);
        expect(h.llm.recommendationCalls).toBe(1);

        const stored = await h.db
            .from('recommendations')
            .select('recommendation_id, summary_id, content')
            .eq('recommendation_id', recommendation.recommendationId)
            .single();
        expect(stored.error).toBeNull();
        expect(stored.data).toEqual({
            recommendation_id: recommendation.recommendationId,
            summary_id: recommendation.summaryId,
            content: recommendation.content,
        });
    });

    it('IT7A-S04 rejects summary creation when progress is unavailable', async () => {
        await expect(h.deps.insightService.trackProgress(h.studentA2.studentId))
            .rejects.toMatchObject({ message: 'progressUnavailable' });
        expect(h.llm.summaryCalls).toBe(0);
        await expect(h.deps.summaryRepo.latestByStudent(h.studentA2.studentId))
            .resolves.toBeNull();
    });

    it('IT7A-S05 stores no partial generated record when generation fails', async () => {
        const student = await h.createStudent({
            parentId: h.parentA.parentId,
            withProgress: true,
        });
        h.llm.mode = 'fail';

        await expect(h.deps.insightService.trackProgress(student.studentId))
            .rejects.toMatchObject({ message: 'summaryUnavailable' });
        await expect(h.deps.summaryRepo.latestByStudent(student.studentId))
            .resolves.toBeNull();

        h.llm.mode = 'ok';
        const summary = await h.deps.insightService.getSummary(student.studentId);
        h.llm.mode = 'fail';

        await expect(h.deps.insightService.createRecommendation(student.studentId))
            .rejects.toMatchObject({ message: 'recommendationUnavailable' });
        const rows = await h.db
            .from('recommendations')
            .select('recommendation_id', { count: 'exact' })
            .eq('summary_id', summary.summaryId);
        expect(rows.error).toBeNull();
        expect(rows.count).toBe(0);
    });

    it('IT7A-S06 requires a stored summary before recommendation generation', async () => {
        const student = await h.createStudent({
            parentId: h.parentA.parentId,
            withProgress: true,
        });

        await expect(h.deps.insightService.createRecommendation(student.studentId))
            .rejects.toMatchObject({ message: 'summaryUnavailable' });
        expect(h.llm.summaryCalls).toBe(0);
        expect(h.llm.recommendationCalls).toBe(0);
        await expect(h.deps.summaryRepo.latestByStudent(student.studentId))
            .resolves.toBeNull();
    });
});
