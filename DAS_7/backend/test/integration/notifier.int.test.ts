// Under ESM the `jest` object is not injected as a global — it must be imported.
import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import type { TestHarness } from '../helpers/harness.js';
import { createHarness, describeIntegration } from '../helpers/harness.js';
import { createScheduler } from '../../src/services/scheduler.js';

describeIntegration('notifier (integration)', () => {
    let h: TestHarness;

    beforeAll(async () => {
        h = await createHarness();
    });

    afterAll(async () => {
        await h.cleanup();
    });

    beforeEach(() => {
        h.email.mode = 'ok';
        h.llm.reset();
    });

    /**
     * A parent whose every student has progress — the shared `parentA` fixture
     * deliberately includes a student with none, which fails the whole parent.
     */
    async function dueParent(opts: { withProgress?: boolean; enabled?: boolean } = {}) {
        const { withProgress = true, enabled = true } = opts;
        const parent = await h.createParent();
        const student = await h.createStudent({ parentId: parent.parentId, withProgress });
        const recipientEmail = `notify-${randomUUID()}@test.dev`;
        await h.deps.preferenceRepo.upsert({
            parentId: parent.parentId, enabled, frequency: 'Weekly', recipientEmail,
        });
        return { parent, student, recipientEmail };
    }

    it('IT7B-01/03 — notifies the parent, stores the summary and records the send', async () => {
        const { parent, student, recipientEmail } = await dueParent();
        const before = h.email.history.length;

        const outcome = await h.deps.notifierService.notifyParent(parent.parentId, new Date());

        expect(outcome).toBe('parentNotified');

        const sent = h.email.history.slice(before);
        expect(sent).toHaveLength(1);
        expect(sent[0].to).toBe(recipientEmail);
        expect(sent[0].body).toContain(student.name);
        expect(sent[0].subject).toContain(student.name);

        // The insight service persisted the freshly generated summary (IT7B-03).
        const summary = await h.deps.summaryRepo.latestByStudent(student.studentId);
        expect(summary).not.toBeNull();
        expect(summary?.content).toBeTruthy();

        await expect(h.deps.emailNotificationRepo.lastSentAt(parent.parentId))
            .resolves.not.toBeNull();
    });

    it('IT7B-02 — a failing email provider leaves no notification behind', async () => {
        const { parent } = await dueParent();
        const before = h.email.history.length;
        const lastSentBefore = await h.deps.emailNotificationRepo.lastSentAt(parent.parentId);
        h.email.mode = 'fail';

        const outcome = await h.deps.notifierService.notifyParent(parent.parentId, new Date());

        expect(outcome).toBe('notificationFailed');
        expect(h.email.history.slice(before)).toHaveLength(0);
        await expect(h.deps.emailNotificationRepo.lastSentAt(parent.parentId))
            .resolves.toBe(lastSentBefore);
    });

    it('IT7B-04 — an unavailable LLM fails the notification without sending', async () => {
        const { parent } = await dueParent({ withProgress: true });
        const before = h.email.history.length;
        h.llm.mode = 'fail';

        const outcome = await h.deps.notifierService.notifyParent(parent.parentId, new Date());

        expect(outcome).toBe('notificationFailed');
        expect(h.email.history.slice(before)).toHaveLength(0);
        await expect(h.deps.emailNotificationRepo.lastSentAt(parent.parentId))
            .resolves.toBeNull();
    });

    it('IT7B-05 — a student with no progress fails the notification', async () => {
        const { parent } = await dueParent({ withProgress: false });
        const before = h.email.history.length;

        const outcome = await h.deps.notifierService.notifyParent(parent.parentId, new Date());

        expect(outcome).toBe('notificationFailed');
        expect(h.email.history.slice(before)).toHaveLength(0);
        await expect(h.deps.emailNotificationRepo.lastSentAt(parent.parentId))
            .resolves.toBeNull();
    });

    it('does not notify a parent whose preference is disabled', async () => {
        const { parent } = await dueParent({ enabled: false });
        const before = h.email.history.length;

        const outcome = await h.deps.notifierService.notifyParent(parent.parentId, new Date());

        expect(outcome).toBe('notificationFailed');
        expect(h.email.history.slice(before)).toHaveLength(0);
    });

    describe('IT7B-06 — scheduler tick', () => {
        afterEach(() => {
            jest.useRealTimers();
        });

        it('sweeps due parents on a timer tick', async () => {
            const { recipientEmail } = await dueParent();

            // Fake timers prove the tick fires; the sweep it starts is real network
            // work, which no amount of timer advancing completes, so it is awaited.
            const sweeps: Array<Promise<unknown>> = [];

            jest.useFakeTimers();
            const scheduler = createScheduler(now => {
                const sweep = h.deps.notifierService.runDueNotifications(now);
                sweeps.push(sweep);
                return sweep;
            }, 1000);
            scheduler.start();
            await jest.advanceTimersByTimeAsync(1000);
            scheduler.stop();
            jest.useRealTimers();

            expect(sweeps).toHaveLength(1);
            await Promise.all(sweeps);

            // runDueNotifications legitimately sweeps every enabled preference in
            // the shared test database, so assert by recipient rather than count.
            expect(h.email.history.some(e => e.to === recipientEmail)).toBe(true);
        });
    });
});
