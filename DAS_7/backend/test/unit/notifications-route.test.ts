import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import type { Deps, NotifyOutcome } from '../../src/deps.js';
import type { Parent } from '../../src/types.js';
import { errorHandler } from '../../src/http/error-handler.js';
import { notificationRoutes } from '../../src/http/routes/notifications.routes.js';

const parent: Parent = {
    parentId: 'parent-1',
    name: 'Test Parent',
    email: 'parent@example.com',
    mobileNumber: '+6591234567',
    studentIds: ['student-1'],
};

function makeApp(outcome: NotifyOutcome) {
    const notifyParent = jest.fn(async () => outcome);
    const deps = { notifierService: { notifyParent } } as unknown as Deps;
    const app = express();

    app.use((req, _res, next) => {
        req.parent = parent;
        next();
    });
    app.use('/parents', notificationRoutes(deps));
    app.use(errorHandler);

    return { app, notifyParent };
}

describe('notificationRoutes', () => {
    it('sends an update for the authenticated parent', async () => {
        const { app, notifyParent } = makeApp('parentNotified');

        const res = await request(app).post('/parents/parent-1/notifications');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true, data: { outcome: 'parentNotified' } });
        expect(notifyParent).toHaveBeenCalledWith('parent-1', expect.any(Date));
    });

    it('does not reveal or notify a different parent', async () => {
        const { app, notifyParent } = makeApp('parentNotified');

        const res = await request(app).post('/parents/parent-2/notifications');

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ ok: false, error: 'notFound' });
        expect(notifyParent).not.toHaveBeenCalled();
    });

    it('returns 503 when delivery fails', async () => {
        const { app } = makeApp('notificationFailed');

        const res = await request(app).post('/parents/parent-1/notifications');

        expect(res.status).toBe(503);
        expect(res.body).toEqual({ ok: false, error: 'notificationFailed' });
    });
});
