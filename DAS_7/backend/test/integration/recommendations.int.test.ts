import request from 'supertest';
import { createHarness, describeIntegration } from '../helpers/harness.js';
import type { TestHarness } from '../helpers/harness.js';

describeIntegration('recommendations (IT7A)', () => {
    let h: TestHarness;

    beforeAll(async () => { h = await createHarness(); });
    beforeEach(() => h.llm.reset());
    afterAll(async () => { await h?.cleanup(); });

    /** A recommendation is generated from a stored summary, so prime one first. */
    async function primeSummary(studentId: string): Promise<void> {
        const res = await request(h.app)
            .get(`/api/students/${studentId}/track-progress`)
            .set('Authorization', `Bearer ${h.tokenA}`);
        expect(res.status).toBe(200);
    }

    it('IT7A-03 creates a recommendation keyed to the stored summary', async () => {
        await primeSummary(h.studentA1.studentId);
        const stored = await h.deps.summaryRepo.latestByStudent(h.studentA1.studentId);

        const res = await request(h.app)
            .post(`/api/students/${h.studentA1.studentId}/recommendations`)
            .set('Authorization', `Bearer ${h.tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.summaryId).toBe(stored!.summaryId);
        expect(res.body.data.content).toContain('\n');
        expect(h.llm.recommendationCalls).toBe(1);
    });

    it('IT7A-08 returns 404 summaryUnavailable when no summary was ever generated', async () => {
        const s = await h.createStudent({ parentId: h.parentA.parentId, withProgress: true });

        const res = await request(h.app)
            .post(`/api/students/${s.studentId}/recommendations`)
            .set('Authorization', `Bearer ${h.tokenA}`);

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ ok: false, error: 'summaryUnavailable' });
        expect(h.llm.summaryCalls).toBe(0);   // the recommendation path never generates one
    });

    it('IT7A-09 returns 503 recommendationUnavailable when generation fails', async () => {
        await primeSummary(h.studentA1.studentId);
        h.llm.mode = 'fail';

        const res = await request(h.app)
            .post(`/api/students/${h.studentA1.studentId}/recommendations`)
            .set('Authorization', `Bearer ${h.tokenA}`);

        expect(res.status).toBe(503);
        expect(res.body).toEqual({ ok: false, error: 'recommendationUnavailable' });
    });

    it('returns 404 progressUnavailable for another parent\'s student', async () => {
        const res = await request(h.app)
            .post(`/api/students/${h.studentB1.studentId}/recommendations`)
            .set('Authorization', `Bearer ${h.tokenA}`);

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ ok: false, error: 'progressUnavailable' });
    });
});
