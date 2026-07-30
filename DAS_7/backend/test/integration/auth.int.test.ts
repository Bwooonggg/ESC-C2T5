import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createHarness, describeIntegration, type TestHarness } from '../helpers/harness.js';

describeIntegration('auth integration (IT7A-06)', () => {
    let h: TestHarness;

    beforeAll(async () => {
        h = await createHarness();
    });

    afterAll(async () => {
        await h?.cleanup();
    });

    describe('GET /api/me', () => {
        it('rejects a request with no token', async () => {
            const res = await request(h.app).get('/api/me');

            expect(res.status).toBe(401);
            expect(res.body).toEqual({ ok: false, error: 'unauthorised' });
        });

        it('rejects a token that is not a JWT', async () => {
            const res = await request(h.app)
                .get('/api/me')
                .set('Authorization', 'Bearer garbage');

            expect(res.status).toBe(401);
            expect(res.body).toEqual({ ok: false, error: 'unauthorised' });
        });

        it('returns the signed-in parent and their students', async () => {
            const res = await request(h.app)
                .get('/api/me')
                .set('Authorization', `Bearer ${h.tokenA}`);

            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.data.parent.parentId).toBe(h.parentA.parentId);

            const studentIds = res.body.data.students.map((s: { studentId: string }) => s.studentId);
            expect(studentIds).toEqual(expect.arrayContaining([
                h.studentA1.studentId, h.studentA2.studentId,
            ]));
            expect(studentIds).not.toContain(h.studentB1.studentId);
        });
    });

    describe('protected student routes', () => {
        it('IT7A-06 (authn): rejects track-progress without a token', async () => {
            const res = await request(h.app)
                .get(`/api/students/${h.studentA1.studentId}/track-progress`);

            expect(res.status).toBe(401);
            expect(res.body).toEqual({ ok: false, error: 'unauthorised' });
        });

        it("IT7A-06 (authz): another parent's student is indistinguishable from a nonexistent one", async () => {
            const foreign = await request(h.app)
                .get(`/api/students/${h.studentB1.studentId}/track-progress`)
                .set('Authorization', `Bearer ${h.tokenA}`);

            const nonexistent = await request(h.app)
                .get(`/api/students/${randomUUID()}/track-progress`)
                .set('Authorization', `Bearer ${h.tokenA}`);

            expect(foreign.status).toBe(404);
            expect(foreign.body).toEqual({ ok: false, error: 'progressUnavailable' });

            // The whole point: no probing difference between "not yours" and "not there".
            expect(nonexistent.status).toBe(foreign.status);
            expect(nonexistent.body).toEqual(foreign.body);
        });
    });
});
