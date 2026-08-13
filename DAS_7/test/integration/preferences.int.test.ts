import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createHarness, describeIntegration, type TestHarness } from '../helpers/harness.js';

describeIntegration('preferences API (integration)', () => {
    let h: TestHarness;

    beforeAll(async () => {
        h = await createHarness();
    }, 60000);

    afterAll(async () => {
        await h?.cleanup();
    }, 60000);

    const prefsPath = (parentId: string) => `/parents/${parentId}/preferences`;

    it('GET returns the non-persisted default when no row exists', async () => {
        const res = await request(h.app)
            .get(prefsPath(h.parentA.parentId))
            .set('Authorization', `Bearer ${h.tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            ok: true,
            data: {
                parentId: h.parentA.parentId,
                enabled: false,
                frequency: 'Weekly',
                recipientEmail: h.parentA.email,
            },
        });
    });

    it('IT7B-H01 saves valid notification preferences and reads them back', async () => {
        const body = { enabled: true, frequency: 'Fortnightly', recipientEmail: 'a@test.dev' };
        const expected = { parentId: h.parentA.parentId, ...body };

        const put = await request(h.app)
            .put(prefsPath(h.parentA.parentId))
            .set('Authorization', `Bearer ${h.tokenA}`)
            .send(body);

        expect(put.status).toBe(200);
        expect(put.body).toEqual({ ok: true, data: expected });

        const get = await request(h.app)
            .get(prefsPath(h.parentA.parentId))
            .set('Authorization', `Bearer ${h.tokenA}`);

        expect(get.status).toBe(200);
        expect(get.body).toEqual({ ok: true, data: expected });
    });

    it('PUT with an unknown frequency is a 400 and leaves the stored row untouched', async () => {
        const before = await request(h.app)
            .get(prefsPath(h.parentA.parentId))
            .set('Authorization', `Bearer ${h.tokenA}`);

        const res = await request(h.app)
            .put(prefsPath(h.parentA.parentId))
            .set('Authorization', `Bearer ${h.tokenA}`)
            .send({ enabled: true, frequency: 'Daily', recipientEmail: 'a@test.dev' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            ok: false,
            error: '`frequency` must be one of: Weekly, Fortnightly, Monthly.',
        });

        const after = await request(h.app)
            .get(prefsPath(h.parentA.parentId))
            .set('Authorization', `Bearer ${h.tokenA}`);

        expect(after.body).toEqual(before.body);
    });

    it("another parent's id is indistinguishable from a nonexistent one", async () => {
        const strangerId = randomUUID();
        const auth = `Bearer ${h.tokenA}`;

        const getForeign = await request(h.app).get(prefsPath(h.parentB.parentId)).set('Authorization', auth);
        const getUnknown = await request(h.app).get(prefsPath(strangerId)).set('Authorization', auth);

        expect(getForeign.status).toBe(404);
        expect(getForeign.body).toEqual({ ok: false, error: 'notFound' });
        expect(getUnknown.status).toBe(404);
        expect(getUnknown.body).toEqual(getForeign.body);

        const body = { enabled: true, frequency: 'Monthly', recipientEmail: 'b@test.dev' };
        const putForeign = await request(h.app).put(prefsPath(h.parentB.parentId)).set('Authorization', auth).send(body);
        const putUnknown = await request(h.app).put(prefsPath(strangerId)).set('Authorization', auth).send(body);

        expect(putForeign.status).toBe(404);
        expect(putForeign.body).toEqual({ ok: false, error: 'notFound' });
        expect(putUnknown.status).toBe(404);
        expect(putUnknown.body).toEqual(putForeign.body);
    });

    it('rejects an unauthenticated request with 401', async () => {
        const get = await request(h.app).get(prefsPath(h.parentA.parentId));
        expect(get.status).toBe(401);
        expect(get.body).toEqual({ ok: false, error: 'unauthorised' });

        const put = await request(h.app)
            .put(prefsPath(h.parentA.parentId))
            .send({ enabled: true, frequency: 'Weekly', recipientEmail: 'a@test.dev' });
        expect(put.status).toBe(401);
        expect(put.body).toEqual({ ok: false, error: 'unauthorised' });
    });
});
