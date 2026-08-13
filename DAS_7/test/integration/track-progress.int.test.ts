import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createHarness, describeIntegration } from '../helpers/harness.js';
import type { TestHarness } from '../helpers/harness.js';

describeIntegration('track progress (IT7A)', () => {
    let h: TestHarness;

    beforeAll(async () => { h = await createHarness(); });
    beforeEach(() => h.llm.reset());
    afterAll(async () => { await h?.cleanup(); });

    it('IT7A-H01 tracks progress through the authenticated HTTP endpoint', async () => {
        const res = await request(h.app)
            .get(`/students/${h.studentA1.studentId}/track-progress`)
            .set('Authorization', `Bearer ${h.tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        const { progress, summary } = res.body.data;
        expect(progress.length).toBeGreaterThan(0);
        const dates = progress.map((r: { date: string }) => r.date);
        expect(dates).toEqual([...dates].sort());
        expect(summary.content.length).toBeGreaterThan(0);
        expect(h.llm.summaryCalls).toBe(1);

        const stored = await h.deps.summaryRepo.latestByStudent(h.studentA1.studentId);
        expect(stored).not.toBeNull();
        expect(stored!.summaryId).toBe(summary.summaryId);
        expect(stored!.content).toBe(summary.content);

        // Second call: no new progress, so the stored summary is served as-is.
        const again = await request(h.app)
            .get(`/students/${h.studentA1.studentId}/track-progress`)
            .set('Authorization', `Bearer ${h.tokenA}`);

        expect(again.status).toBe(200);
        expect(again.body.data.summary.summaryId).toBe(summary.summaryId);
        expect(h.llm.summaryCalls).toBe(1);
    });

    it('serves the same summary from the standalone summary endpoint', async () => {
        const viaTrack = await request(h.app)
            .get(`/students/${h.studentA1.studentId}/track-progress`)
            .set('Authorization', `Bearer ${h.tokenA}`);
        const viaSummary = await request(h.app)
            .get(`/students/${h.studentA1.studentId}/summary`)
            .set('Authorization', `Bearer ${h.tokenA}`);

        expect(viaSummary.status).toBe(200);
        expect(viaSummary.body.data.summaryId).toBe(viaTrack.body.data.summary.summaryId);
    });

    it('IT7A-H03 returns 404 progressUnavailable for a student that does not exist', async () => {
        const res = await request(h.app)
            .get(`/students/${randomUUID()}/track-progress`)
            .set('Authorization', `Bearer ${h.tokenA}`);

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ ok: false, error: 'progressUnavailable' });
    });

    it('IT7A-H03 returns 404 progressUnavailable for another parent\'s student', async () => {
        const res = await request(h.app)
            .get(`/students/${h.studentB1.studentId}/track-progress`)
            .set('Authorization', `Bearer ${h.tokenA}`);

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ ok: false, error: 'progressUnavailable' });
    });

    it('IT7A-05 returns 503 progressUnavailable when the student has no progress', async () => {
        const res = await request(h.app)
            .get(`/students/${h.studentA2.studentId}/track-progress`)
            .set('Authorization', `Bearer ${h.tokenA}`);

        expect(res.status).toBe(503);
        expect(res.body).toEqual({ ok: false, error: 'progressUnavailable' });
    });

    it('IT7A-07 returns 503 summaryUnavailable and stores nothing when generation fails', async () => {
        const s = await h.createStudent({ parentId: h.parentA.parentId, withProgress: true });
        h.llm.mode = 'fail';

        const res = await request(h.app)
            .get(`/students/${s.studentId}/track-progress`)
            .set('Authorization', `Bearer ${h.tokenA}`);

        expect(res.status).toBe(503);
        expect(res.body).toEqual({ ok: false, error: 'summaryUnavailable' });
        expect(await h.deps.summaryRepo.latestByStudent(s.studentId)).toBeNull();
    });
});
