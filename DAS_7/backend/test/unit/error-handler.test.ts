import express from 'express';
import request from 'supertest';
import type { AppConfig } from '../../src/config.js';
import type { Deps } from '../../src/deps.js';
import { createApp } from '../../src/app.js';
import {
    ApiError, NotFoundError, UnauthorizedError, UnavailableError, ValidationError,
} from '../../src/errors.js';
import { errorHandler, notFoundHandler } from '../../src/http/error-handler.js';

/** Tiny throwaway app: one route that throws whatever the test hands it. */
function appThatThrows(thrown: unknown, async = false) {
    const app = express();
    app.get('/boom', async
        ? async () => { throw thrown; }
        : () => { throw thrown; });
    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
}

describe('errorHandler', () => {
    // console.error is swapped by hand rather than with jest.spyOn: under ESM the
    // `jest` object is NOT injected as a global. Suites that need it must
    // `import { jest } from '@jest/globals'` — describe/it/expect stay global.
    const realConsoleError = console.error;
    let logged: unknown[][] = [];

    beforeEach(() => {
        logged = [];
        console.error = (...args: unknown[]) => { logged.push(args); };
    });

    afterEach(() => {
        console.error = realConsoleError;
    });

    const cases: Array<{ name: string; error: ApiError; status: number; message: string }> = [
        { name: 'UnauthorizedError', error: new UnauthorizedError(), status: 401, message: 'unauthorised' },
        { name: 'NotFoundError (default)', error: new NotFoundError(), status: 404, message: 'notFound' },
        { name: 'NotFoundError (custom)', error: new NotFoundError('progressUnavailable'), status: 404, message: 'progressUnavailable' },
        { name: 'ValidationError', error: new ValidationError('frequency must be Weekly, Fortnightly or Monthly'), status: 400, message: 'frequency must be Weekly, Fortnightly or Monthly' },
        { name: 'UnavailableError', error: new UnavailableError('summaryUnavailable'), status: 503, message: 'summaryUnavailable' },
        { name: 'ApiError (direct)', error: new ApiError(501, 'notImplemented'), status: 501, message: 'notImplemented' },
    ];

    it.each(cases)('maps $name to $status with its message', async ({ error, status, message }) => {
        const res = await request(appThatThrows(error)).get('/boom');

        expect(res.status).toBe(status);
        expect(res.body).toEqual({ ok: false, error: message });
        expect(logged).toHaveLength(0);
    });

    it('maps a generic Error to 500 internalError without leaking the message', async () => {
        const res = await request(appThatThrows(new Error('connection string: postgres://secret'))).get('/boom');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ ok: false, error: 'internalError' });
        expect(JSON.stringify(res.body)).not.toContain('secret');
        expect(logged).toHaveLength(1);
    });

    it('catches a rejected async handler (Express 5)', async () => {
        const res = await request(appThatThrows(new UnavailableError('recommendationUnavailable'), true)).get('/boom');

        expect(res.status).toBe(503);
        expect(res.body).toEqual({ ok: false, error: 'recommendationUnavailable' });
    });
});

describe('notFoundHandler', () => {
    it('returns 404 notFound for an unknown route', async () => {
        const app = express();
        app.use(notFoundHandler);
        app.use(errorHandler);

        const res = await request(app).get('/nope');

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ ok: false, error: 'notFound' });
    });
});

describe('createApp', () => {
    // Dummy graph: the health route is mounted before authentication and touches
    // none of these, so the unimplemented members are never reached.
    const config: AppConfig = {
        nodeEnv: 'test',
        port: 4000,
        supabaseUrl: 'https://example.supabase.co',
        supabaseServiceRoleKey: 'service-role-key',
        supabaseDbSchema: 'insight',
        supabaseJwksUrl: 'https://example.supabase.co/auth/v1/.well-known/jwks.json',
        supabaseJwtSecret: null,
        authDevSub: null,
        llmProvider: 'stub',
        llmApiKey: null,
        llmModel: null,
        llmTimeoutMs: 10000,
        emailProvider: 'fake',
        brevoApiKey: null,
        emailFrom: null,
        schedulerEnabled: false,
        schedulerTickMs: 900000,
        notifyIntervalsMs: { Weekly: 604800000, Fortnightly: 1209600000, Monthly: 2592000000 },
    };
    const deps = { config } as Deps;

    it('serves GET /health without authentication', async () => {
        const res = await request(createApp(deps)).get('/health');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true, data: { ok: true } });
    });

    it('does not answer on the gateway-prefixed path', async () => {
        // The public URL is /api/insights/health; Traefik and the Vite proxy both
        // strip that prefix, so the app itself must never see it.
        const res = await request(createApp(deps)).get('/api/insights/health');

        expect(res.status).toBe(401);
    });

    it('rejects an unauthenticated request to a route below health', async () => {
        // Everything after the health mount sits behind createAuthenticate, so an
        // unknown path is rejected as unauthorised before notFoundHandler runs.
        const res = await request(createApp(deps)).get('/me');

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ ok: false, error: 'unauthorised' });
    });
});
