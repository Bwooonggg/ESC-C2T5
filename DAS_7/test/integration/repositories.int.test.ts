import { createHarness, describeIntegration, type TestHarness } from '../helpers/harness.js';

describeIntegration('Level 1 repository cluster', () => {
    let h: TestHarness;

    beforeAll(async () => {
        h = await createHarness();
    });

    afterAll(async () => {
        await h?.cleanup();
    });

    it('BU7-R01 reads and maps parent, student, and ordered progress data', async () => {
        const parent = await h.deps.parentRepo.byAuthUserId(h.authUserIdA);
        expect(parent).toEqual(h.parentA);
        expect(parent?.studentIds).toEqual(expect.arrayContaining([
            h.studentA1.studentId,
            h.studentA2.studentId,
        ]));

        await expect(
            h.deps.studentRepo.isGuardian(h.parentA.parentId, h.studentA1.studentId),
        ).resolves.toBe(true);

        const progress = await h.deps.progressRepo.listByStudent(h.studentA1.studentId);
        expect(progress).not.toHaveLength(0);
        expect(progress.every(record => record.studentId === h.studentA1.studentId)).toBe(true);
        expect(progress.map(record => record.date)).toEqual(
            [...progress.map(record => record.date)].sort(),
        );
        expect(progress[0]).toEqual(expect.objectContaining({
            recordId: expect.any(String),
            studentId: h.studentA1.studentId,
            date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            skillArea: expect.any(String),
            score: expect.any(Number),
            notes: expect.any(String),
        }));
    });

    it('BU7-R02 persists a summary and a recommendation linked to it', async () => {
        const summary = await h.deps.summaryRepo.insert({
            studentId: h.studentA1.studentId,
            content: 'BU7-R02 repository summary',
        });

        expect(summary).toEqual(expect.objectContaining({
            summaryId: expect.any(String),
            studentId: h.studentA1.studentId,
            content: 'BU7-R02 repository summary',
            generatedAt: expect.any(String),
        }));
        expect(Number.isNaN(Date.parse(summary.generatedAt))).toBe(false);
        await expect(h.deps.summaryRepo.latestByStudent(h.studentA1.studentId))
            .resolves.toEqual(summary);

        const recommendation = await h.deps.recommendationRepo.insert({
            summaryId: summary.summaryId,
            content: 'BU7-R02 repository recommendation',
        });
        expect(recommendation).toEqual(expect.objectContaining({
            recommendationId: expect.any(String),
            summaryId: summary.summaryId,
            content: 'BU7-R02 repository recommendation',
            generatedAt: expect.any(String),
        }));

        const stored = await h.db
            .from('recommendations')
            .select('summary_id, content')
            .eq('recommendation_id', recommendation.recommendationId)
            .single();
        expect(stored.error).toBeNull();
        expect(stored.data).toEqual({
            summary_id: summary.summaryId,
            content: 'BU7-R02 repository recommendation',
        });
    });

    it('BU7-R03 persists enabled preferences and notification history', async () => {
        const preference = await h.deps.preferenceRepo.upsert({
            parentId: h.parentA.parentId,
            enabled: true,
            frequency: 'Weekly',
            recipientEmail: 'bu7-r03@test.dev',
        });
        expect(preference).toEqual({
            parentId: h.parentA.parentId,
            enabled: true,
            frequency: 'Weekly',
            recipientEmail: 'bu7-r03@test.dev',
        });

        const enabled = await h.deps.preferenceRepo.listEnabled();
        expect(enabled).toContainEqual(preference);

        const summary = await h.deps.summaryRepo.latestByStudent(h.studentA1.studentId);
        await h.deps.emailNotificationRepo.insert({
            parentId: h.parentA.parentId,
            summaryId: summary?.summaryId ?? null,
            recipientEmail: preference.recipientEmail,
            subject: 'BU7-R03 subject',
            body: 'BU7-R03 body',
        });

        const lastSentAt = await h.deps.emailNotificationRepo.lastSentAt(h.parentA.parentId);
        expect(lastSentAt).not.toBeNull();
        expect(Number.isNaN(Date.parse(lastSentAt!))).toBe(false);
    });
});
