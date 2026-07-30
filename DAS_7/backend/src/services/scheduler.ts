export interface Scheduler {
    start(): void;
    stop(): void;
}

/**
 * In-process timer. `start()` is idempotent — a second call while running is a
 * no-op — and a rejecting `run` is logged, never left as an unhandled rejection.
 * The interval is unref'd so it can never hold the process open.
 */
export function createScheduler(
    run: (now: Date) => Promise<unknown>, tickMs: number,
): Scheduler {
    let timer: ReturnType<typeof setInterval> | null = null;

    return {
        start(): void {
            if (timer !== null) return;
            timer = setInterval(() => {
                Promise.resolve()
                    .then(() => run(new Date()))
                    .catch((err: unknown) => { console.error('[scheduler] tick failed', err); });
            }, tickMs);
            timer.unref?.();
        },

        stop(): void {
            if (timer === null) return;
            clearInterval(timer);
            timer = null;
        },
    };
}
