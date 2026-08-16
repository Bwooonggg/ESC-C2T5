// @ts-nocheck -- behaviour is type-checked through production interfaces; Jest mock APIs are dynamic.
import { createInsightService } from '../../src/services/insight.service.js';
import { jest } from '@jest/globals';
import { createNotifierService, isDue } from '../../src/services/notifier.service.js';
import { createPreferenceService } from '../../src/services/preference.service.js';
import { createScheduler } from '../../src/services/scheduler.js';
import { config, mockDeps, parent, preference, record, student, summary } from './helpers.js';

describe('InsightService', () => {
    it('UT-DAS7-U02-01 shared summary returns a second progress read', async () => {
        const d = mockDeps();
        const second = [{ ...record, recordId: 'r2' }];
        d.studentRepo.byId.mockResolvedValue(student);
        d.progressRepo.listByStudent.mockResolvedValueOnce([record]).mockResolvedValueOnce(second);
        d.summaryRepo.latestByStudent.mockResolvedValue(summary);
        d.progressRepo.latestCreatedAt.mockResolvedValue(null);

        await expect(createInsightService(d).trackProgress('s1')).resolves.toEqual({ progress: second, summary });
        expect(d.progressRepo.listByStudent).toHaveBeenCalledTimes(2);
    });
    it('UT-DAS7-U03-02 zero records rejects before later reads', async () => {
        const d = mockDeps();
        d.studentRepo.byId.mockResolvedValue(student);
        d.progressRepo.listByStudent.mockResolvedValue([]);

        await expect(createInsightService(d).getSummary('s1')).rejects.toEqual(expect.objectContaining({ message: 'progressUnavailable', status: 503 }));
        expect(d.summaryRepo.latestByStudent).not.toHaveBeenCalled();
    });
    it.each([
        ['UT-DAS7-U03-03', null, summary.generatedAt],
        ['UT-DAS7-U03-04', '2026-01-01T23:59:59.999Z', summary.generatedAt],
        ['UT-DAS7-U03-05', summary.generatedAt, summary.generatedAt],
    ])('%s returns stored fresh summary', async (_id, newest) => {
        const d = mockDeps();
        d.studentRepo.byId.mockResolvedValue(student);
        d.progressRepo.listByStudent.mockResolvedValue([record]);
        d.summaryRepo.latestByStudent.mockResolvedValue(summary);
        d.progressRepo.latestCreatedAt.mockResolvedValue(newest);

        await expect(createInsightService(d).getSummary('s1')).resolves.toEqual(summary);
        expect(d.llm.generateSummary).not.toHaveBeenCalled();
    });
    it('UT-DAS7-U03-06 newer record regenerates', async () => {
        const d = mockDeps();
        const fresh = { ...summary, content: 'fresh' };
        d.studentRepo.byId.mockResolvedValue(student);
        d.progressRepo.listByStudent.mockResolvedValue([record]);
        d.summaryRepo.latestByStudent.mockResolvedValue(summary);
        d.progressRepo.latestCreatedAt.mockResolvedValue('2026-01-02T00:00:00.001Z');
        d.llm.generateSummary.mockResolvedValue('fresh');
        d.summaryRepo.insert.mockResolvedValue(fresh);

        await expect(createInsightService(d).getSummary('s1')).resolves.toEqual(fresh);
        expect(d.summaryRepo.insert).toHaveBeenCalledWith({ studentId: 's1', content: 'fresh' });
    });
    it('UT-DAS7-U03-07 absent summary generates and inserts', async () => {
        const d = mockDeps();
        d.studentRepo.byId.mockResolvedValue(student);
        d.progressRepo.listByStudent.mockResolvedValue([record]);
        d.summaryRepo.latestByStudent.mockResolvedValue(null);
        d.progressRepo.latestCreatedAt.mockResolvedValue(null);
        d.llm.generateSummary.mockResolvedValue('fresh');
        d.summaryRepo.insert.mockResolvedValue(summary);

        await expect(createInsightService(d).getSummary('s1')).resolves.toEqual(summary);
    });
    it('UT-DAS7-U03-08 generation failure is normalised and logged', async () => {
        const d = mockDeps();
        const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        d.studentRepo.byId.mockResolvedValue(student);
        d.progressRepo.listByStudent.mockResolvedValue([record]);
        d.summaryRepo.latestByStudent.mockResolvedValue(null);
        d.progressRepo.latestCreatedAt.mockResolvedValue(null);
        d.llm.generateSummary.mockRejectedValue(new Error('offline'));

        await expect(createInsightService(d).getSummary('s1')).rejects.toEqual(
            expect.objectContaining({ message: 'summaryUnavailable' }),
        );
        expect(d.summaryRepo.insert).not.toHaveBeenCalled();
        spy.mockRestore();
    });
    it('UT-DAS7-U09-02 missing summary rejects', async () => {
        const d = mockDeps();
        d.studentRepo.byId.mockResolvedValue(student);
        d.summaryRepo.latestByStudent.mockResolvedValue(null);

        await expect(createInsightService(d).createRecommendation('s1')).rejects.toEqual(
            expect.objectContaining({ message: 'summaryUnavailable' }),
        );
    });
    it('UT-DAS7-U09-03 inserts recommendation', async () => {
        const d = mockDeps();
        d.studentRepo.byId.mockResolvedValue(student);
        d.summaryRepo.latestByStudent.mockResolvedValue(summary);
        d.llm.generateRecommendation.mockResolvedValue('advice');
        d.recommendationRepo.insert.mockResolvedValue({
            recommendationId: 'rec1',
            summaryId: 'sum1',
            content: 'advice',
            generatedAt: 'x',
        });

        await expect(createInsightService(d).createRecommendation('s1')).resolves.toEqual(
            expect.objectContaining({ content: 'advice' }),
        );
    });
});

describe('PreferenceService', () => {
    it.each([
        ['UT-DAS7-U13-03', { enabled: true, frequency: 'weekly' }, '`frequency`'],
    ])('%s validates first invalid field', async (_id, body, message) => {
        const d = mockDeps();

        await expect(createPreferenceService(d).save('p1', body)).rejects.toThrow(message);
        expect(d.preferenceRepo.upsert).not.toHaveBeenCalled();
    });
    it('UT-DAS7-U13-05 normalises email and URL parent wins', async () => {
        const d = mockDeps();
        d.preferenceRepo.upsert.mockResolvedValue(preference);
        const body = {
            parentId: 'p2',
            enabled: true,
            frequency: 'Weekly',
            recipientEmail: ' Parent@Example.COM ',
        };

        await createPreferenceService(d).save('p1', body);
        expect(d.preferenceRepo.upsert).toHaveBeenCalledWith(preference);
        expect(body.recipientEmail).toBe(' Parent@Example.COM ');
    });
});

describe('Scheduler and notifier', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });
    it.each([['UT-DAS7-U16-06', 5, 1]])('%s fires at boundary', async (_id, ms, calls) => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        const run = jest.fn().mockResolvedValue(undefined);
        createScheduler(run, 5).start();

        await jest.advanceTimersByTimeAsync(ms);
        expect(run).toHaveBeenCalledTimes(calls);
    });
    it.each([
        ['UT-DAS7-U20-01', null, 'Weekly', true],
        ['UT-DAS7-U20-03', '2026-01-24T00:00:00.001Z', 'Weekly', false],
        ['UT-DAS7-U20-04', '2026-01-24T00:00:00.000Z', 'Weekly', true],
        ['UT-DAS7-U20-05', '2026-01-23T23:59:59.999Z', 'Weekly', true],
        ['UT-DAS7-U20-08', '2026-01-30T23:59:59.999Z', 'Weekly', false],
        ['UT-DAS7-U20-09', '2026-01-31T00:00:00.000Z', 'Weekly', false],
        ['UT-DAS7-U20-10', '2026-01-31T00:00:00.001Z', 'Weekly', false],
    ] as const)('%s calculates due time', (_id, last, frequency, expected) => {
        expect(isDue(
            last,
            frequency,
            new Date('2026-01-31T00:00:00.000Z'),
            config.notifyIntervalsMs,
        )).toBe(expected);
    });
    it('UT-DAS7-U17-02 one non-due preference skips delivery', async () => {
        const d = mockDeps();
        d.preferenceRepo.listEnabled.mockResolvedValue([preference]);
        d.emailNotificationRepo.lastSentAt.mockResolvedValue(new Date().toISOString());

        await expect(createNotifierService(d).runDueNotifications(new Date())).resolves.toEqual([]);
    });
    it('UT-DAS7-U17-03 one due preference invokes notification path', async () => {
        const d = mockDeps();
        d.preferenceRepo.listEnabled.mockResolvedValue([preference]);
        d.emailNotificationRepo.lastSentAt.mockResolvedValue(null);
        d.preferenceRepo.byParentId.mockResolvedValue(preference);
        d.parentRepo.byId.mockResolvedValue(parent);
        d.studentRepo.listByParent.mockResolvedValue([student]);
        d.insightService.getSummary.mockResolvedValue(summary);
        d.email.send.mockResolvedValue(undefined);
        d.emailNotificationRepo.insert.mockResolvedValue(undefined);

        await expect(createNotifierService(d).runDueNotifications(new Date())).resolves.toEqual([
            { parentId: 'p1', outcome: 'parentNotified' },
        ]);
    });
    it('UT-DAS7-U17-04 mixed due preferences preserve order', async () => {
        const d = mockDeps();
        const prefs = ['p1', 'p2', 'p3', 'p4'].map((parentId) => ({ ...preference, parentId }));
        d.preferenceRepo.listEnabled.mockResolvedValue(prefs);
        d.emailNotificationRepo.lastSentAt
            .mockResolvedValueOnce(new Date().toISOString())
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(new Date().toISOString())
            .mockResolvedValueOnce(null);
        d.preferenceRepo.byParentId.mockResolvedValue(preference);
        d.parentRepo.byId.mockResolvedValue(parent);
        d.studentRepo.listByParent.mockResolvedValue([student]);
        d.insightService.getSummary.mockResolvedValue(summary);
        d.email.send.mockResolvedValue(undefined);
        d.emailNotificationRepo.insert.mockResolvedValue(undefined);

        await expect(createNotifierService(d).runDueNotifications(new Date())).resolves.toEqual([
            { parentId: 'p2', outcome: 'parentNotified' },
            { parentId: 'p4', outcome: 'parentNotified' },
        ]);
    });
});

describe('NotifierService.notifyParent', () => {
    function ready() {
        const d = mockDeps();
        d.preferenceRepo.byParentId.mockResolvedValue(preference);
        d.parentRepo.byId.mockResolvedValue(parent);
        d.studentRepo.listByParent.mockResolvedValue([student]);
        d.insightService.getSummary.mockResolvedValue(summary);
        d.email.send.mockResolvedValue(undefined);
        d.emailNotificationRepo.insert.mockResolvedValue(undefined);
        return d;
    }
    it.each([['UT-DAS7-U21-01', (d: ReturnType<typeof ready>) => d.preferenceRepo.byParentId.mockResolvedValue(null)]])(
        '%s known preconditions fail safely',
        async (_id, setup) => {
            const d = ready();
            setup(d);
            const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

            await expect(createNotifierService(d).notifyParent('p1', new Date())).resolves.toBe(
                'notificationFailed',
            );
            spy.mockRestore();
        },
    );
    it('UT-DAS7-U21-06 many students preserve summary order', async () => {
        const d = ready();
        d.studentRepo.listByParent.mockResolvedValue([
            student,
            { ...student, studentId: 's2', name: 'Bea' },
            { ...student, studentId: 's3', name: 'Cy' },
        ]);
        d.insightService.getSummary
            .mockResolvedValueOnce(summary)
            .mockResolvedValueOnce({ ...summary, summaryId: 'sum2', content: 'B' })
            .mockResolvedValueOnce({ ...summary, summaryId: 'sum3', content: 'C' });

        await createNotifierService(d).notifyParent('p1', new Date());

        expect(d.email.send).toHaveBeenCalledWith(expect.objectContaining({
            subject: 'Progress update for Amy, Bea, Cy',
            body: 'Amy:\nAmy is progressing.\n\nBea:\nB\n\nCy:\nC',
        }));
        expect(d.emailNotificationRepo.insert).toHaveBeenCalledWith(
            expect.objectContaining({ summaryId: 'sum1' }),
        );
    });
    it('UT-DAS7-U21-07 summary failure stops following work', async () => {
        const d = ready();
        d.studentRepo.listByParent.mockResolvedValue([
            student,
            { ...student, studentId: 's2' },
            { ...student, studentId: 's3' },
        ]);
        d.insightService.getSummary
            .mockResolvedValueOnce(summary)
            .mockRejectedValueOnce(new Error('bad'));
        const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        await expect(createNotifierService(d).notifyParent('p1', new Date())).resolves.toBe(
            'notificationFailed',
        );
        expect(d.email.send).not.toHaveBeenCalled();
        expect(d.insightService.getSummary).toHaveBeenCalledTimes(2);
        spy.mockRestore();
    });
    it('UT-DAS7-U21-08 email failure does not record', async () => {
        const d = ready();
        d.email.send.mockRejectedValue(new Error('bad'));
        const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        await expect(createNotifierService(d).notifyParent('p1', new Date())).resolves.toBe(
            'notificationFailed',
        );
        expect(d.emailNotificationRepo.insert).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});
