import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createHarness, describeIntegration, type TestHarness } from '../helpers/harness.js';

describeIntegration('Level 3 manual notification HTTP cluster', () => {
    let h: TestHarness;

    beforeAll(async () => {
        h = await createHarness();
    });

    beforeEach(() => {
        h.email.mode = 'ok';
        h.llm.reset();
    });

    afterAll(async () => {
        await h?.cleanup();
    });

    it('IT7B-H01 saves preferences and sends a parent update now', async () => {
        const parent = await h.createParent();
        const student = await h.createStudent({ parentId: parent.parentId, withProgress: true });
        const recipientEmail = `manual-${randomUUID()}@test.dev`;
        const preference = {
            enabled: true,
            frequency: 'Weekly',
            recipientEmail,
        };

        const saved = await request(h.app)
            .put(`/parents/${parent.parentId}/preferences`)
            .set('Authorization', `Bearer ${h.tokenB}`)
            .send(preference);

        expect(saved.status).toBe(200);
        expect(saved.body).toEqual({
            ok: true,
            data: { parentId: parent.parentId, ...preference },
        });

        const before = h.email.history.length;
        const sent = await request(h.app)
            .post(`/parents/${parent.parentId}/notifications`)
            .set('Authorization', `Bearer ${h.tokenB}`);

        expect(sent.status).toBe(200);
        expect(sent.body).toEqual({ ok: true, data: { outcome: 'parentNotified' } });
        expect(h.email.history.slice(before)).toEqual([
            expect.objectContaining({
                to: recipientEmail,
                subject: expect.stringContaining(student.name),
                body: expect.stringContaining(student.name),
            }),
        ]);
        await expect(h.deps.emailNotificationRepo.lastSentAt(parent.parentId))
            .resolves.not.toBeNull();
    });

    it('IT7B-H01 maps an ineligible manual notification to HTTP 503', async () => {
        await h.deps.preferenceRepo.upsert({
            parentId: h.parentA.parentId,
            enabled: true,
            frequency: 'Weekly',
            recipientEmail: `ineligible-${randomUUID()}@test.dev`,
        });
        const lastSentBefore = await h.deps.emailNotificationRepo
            .lastSentAt(h.parentA.parentId);
        const before = h.email.history.length;

        const response = await request(h.app)
            .post(`/parents/${h.parentA.parentId}/notifications`)
            .set('Authorization', `Bearer ${h.tokenA}`);

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ ok: false, error: 'notificationFailed' });
        expect(h.email.history.slice(before)).toHaveLength(0);
        await expect(h.deps.emailNotificationRepo.lastSentAt(h.parentA.parentId))
            .resolves.toBe(lastSentBefore);
    });
});
