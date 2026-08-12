// @ts-nocheck -- Express request augmentation and route test doubles are runtime-only here.
import express from 'express';
import { jest } from '@jest/globals';
import request from 'supertest';
import { errorHandler } from '../../src/http/error-handler.js';
import { studentsRoutes } from '../../src/http/routes/students.routes.js';
import { preferencesRoutes } from '../../src/http/routes/preferences.routes.js';
import { notificationRoutes } from '../../src/http/routes/notifications.routes.js';
import { requireOwnParent, requireOwnStudent } from '../../src/http/auth.js';
import { ForbiddenError, NotFoundError, UnauthorizedError, UnavailableError } from '../../src/errors.js';
import { config, mockDeps, parent, preference } from './helpers.js';

function routeApp(router: express.Router, attachedParent = parent) {
    const app = express(); app.use(express.json()); app.use((_req, _res, next) => { _req.parent = attachedParent; next(); }); app.use(router); app.use(errorHandler); return app;
}

describe('HTTP routes', () => {
    it.each([
        ['UT-DAS7-U01-01', 'get', '/s1/track-progress', 'trackProgress', { progress: [], summary: {} }],
        ['UT-DAS7-U01-03', 'post', '/s1/recommendations', 'createRecommendation', { content: 'advice' }],
    ] as const)('%s owned student route succeeds', async (_id, method, path, service, result) => { const d = mockDeps(); d.studentRepo.isGuardian.mockResolvedValue(true); (d.insightService[service] as jest.Mock).mockResolvedValue(result); const res = await (request(routeApp(studentsRoutes(d)))[method](path)); expect(res.status).toBe(200); expect(res.body).toEqual({ ok: true, data: result }); expect(d.studentRepo.isGuardian).toHaveBeenCalledWith('p1', 's1'); });
    it('UT-DAS7-U01-02 foreign student gives progress unavailable', async () => { const d = mockDeps(); d.studentRepo.isGuardian.mockResolvedValue(false); const res = await request(routeApp(studentsRoutes(d))).get('/s1/track-progress'); expect(res.status).toBe(404); expect(res.body.error).toBe('progressUnavailable'); expect(d.insightService.trackProgress).not.toHaveBeenCalled(); });
    it('UT-DAS7-U12-01 own preference save succeeds', async () => { const d = mockDeps(); d.preferenceService.save.mockResolvedValue(preference); const body = { enabled: true }; const res = await request(routeApp(preferencesRoutes(d))).put('/p1/preferences').send(body); expect(res.status).toBe(200); expect(d.preferenceService.save).toHaveBeenCalledWith('p1', body); });
    it('UT-DAS7-U12-02 foreign preference parent is 404', async () => { const d = mockDeps(); const res = await request(routeApp(preferencesRoutes(d))).put('/p2/preferences').send({}); expect(res.status).toBe(404); expect(d.preferenceService.save).not.toHaveBeenCalled(); });
    it.each([['UT-DAS7-U15-01', 'parentNotified', 200, 'parentNotified'], ['UT-DAS7-U15-02', 'notificationFailed', 503, 'notificationFailed']] as const)('%s reports manual notification outcome', async (_id, outcome, status, error) => { const d = mockDeps(); d.notifierService.notifyParent.mockResolvedValue(outcome); const res = await request(routeApp(notificationRoutes(d))).post('/p1/notifications'); expect(res.status).toBe(status); if (status === 200) expect(res.body.data.outcome).toBe(outcome); else expect(res.body.error).toBe(error); expect(d.notifierService.notifyParent).toHaveBeenCalledWith('p1', expect.any(Date)); });
});

describe('authorization helpers', () => {
    it('UT-DAS7-U29-01 guardian resolves', async () => { const repo = { isGuardian: jest.fn().mockResolvedValue(true) } as any; await expect(requireOwnStudent(repo, parent, 's1')).resolves.toBeUndefined(); });
    it('UT-DAS7-U29-02 non-guardian rejects hidden not-found', async () => { const repo = { isGuardian: jest.fn().mockResolvedValue(false) } as any; await expect(requireOwnStudent(repo, parent, 's1')).rejects.toEqual(expect.objectContaining({ message: 'progressUnavailable' })); });
    it('UT-DAS7-U29-03 guardian error propagates', async () => { const repo = { isGuardian: jest.fn().mockRejectedValue(new Error('db')) } as any; await expect(requireOwnStudent(repo, parent, 's1')).rejects.toThrow('db'); });
    it('UT-DAS7-U29-04 same parent resolves', () => expect(requireOwnParent(parent, 'p1')).toBeUndefined());
    it('UT-DAS7-U29-05 foreign parent is default not found', () => expect(() => requireOwnParent(parent, 'p2')).toThrow(NotFoundError));
});
