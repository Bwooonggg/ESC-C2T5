// Under ESM the `jest` object is not injected as a global — it must be imported.
import { jest } from '@jest/globals';
import { createScheduler } from '../../src/services/scheduler.js';

describe('createScheduler', () => {
    const realConsoleError = console.error;
    let logged: unknown[][];

    beforeEach(() => {
        jest.useFakeTimers();
        logged = [];
        console.error = (...args: unknown[]) => { logged.push(args); };
    });

    afterEach(() => {
        jest.useRealTimers();
        console.error = realConsoleError;
    });

    /** Records the Date each tick passed in. */
    function spyRun(behaviour: 'ok' | 'reject' = 'ok') {
        const calls: Date[] = [];
        const run = async (now: Date): Promise<void> => {
            calls.push(now);
            if (behaviour === 'reject') throw new Error('tick exploded');
        };
        return { calls, run };
    }

    it('does not run before it is started', async () => {
        const { calls, run } = spyRun();
        createScheduler(run, 1000);

        await jest.advanceTimersByTimeAsync(5000);

        expect(calls).toHaveLength(0);
    });

    it('runs once per tick, passing the current Date', async () => {
        const { calls, run } = spyRun();
        const scheduler = createScheduler(run, 1000);

        scheduler.start();
        await jest.advanceTimersByTimeAsync(1000);

        expect(calls).toHaveLength(1);
        expect(calls[0]).toBeInstanceOf(Date);

        scheduler.stop();
    });

    it('keeps ticking', async () => {
        const { calls, run } = spyRun();
        const scheduler = createScheduler(run, 1000);

        scheduler.start();
        await jest.advanceTimersByTimeAsync(3000);

        expect(calls).toHaveLength(3);

        scheduler.stop();
    });

    it('logs a rejecting run and carries on with later ticks', async () => {
        const { calls, run } = spyRun('reject');
        const scheduler = createScheduler(run, 1000);

        scheduler.start();
        await jest.advanceTimersByTimeAsync(3000);

        expect(calls).toHaveLength(3);
        expect(logged).toHaveLength(3);

        scheduler.stop();
    });

    it('stops firing after stop()', async () => {
        const { calls, run } = spyRun();
        const scheduler = createScheduler(run, 1000);

        scheduler.start();
        await jest.advanceTimersByTimeAsync(1000);
        scheduler.stop();
        await jest.advanceTimersByTimeAsync(5000);

        expect(calls).toHaveLength(1);
    });

    it('is idempotent — a second start() does not add a second timer', async () => {
        const { calls, run } = spyRun();
        const scheduler = createScheduler(run, 1000);

        scheduler.start();
        scheduler.start();
        await jest.advanceTimersByTimeAsync(1000);

        expect(calls).toHaveLength(1);

        scheduler.stop();
    });

    it('tolerates stop() before start() and can be restarted', async () => {
        const { calls, run } = spyRun();
        const scheduler = createScheduler(run, 1000);

        scheduler.stop();
        scheduler.start();
        await jest.advanceTimersByTimeAsync(1000);
        scheduler.stop();
        scheduler.start();
        await jest.advanceTimersByTimeAsync(1000);

        expect(calls).toHaveLength(2);

        scheduler.stop();
    });
});
