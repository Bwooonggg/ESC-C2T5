// @ts-nocheck -- fluent Supabase fake deliberately models runtime query chaining.
import { createProgressRepo } from '../../src/repos/progress.repo.js';
import { createSummaryRepo } from '../../src/repos/summary.repo.js';
import { createRecommendationRepo } from '../../src/repos/recommendation.repo.js';
import { createPreferenceRepo } from '../../src/repos/preference.repo.js';
import { createEmailNotificationRepo } from '../../src/repos/emailNotification.repo.js';
import { createParentRepo } from '../../src/repos/parent.repo.js';
import { createStudentRepo } from '../../src/repos/student.repo.js';
import { rowToParent, rowToPreference, rowToRecommendation, rowToSummary } from '../../src/repos/mappers.js';
import { fakeClient } from './helpers.js';

const progressRow = { record_id: 'r1', student_id: 's1', date: '2026-01-01', skill_area: 'Reading Accuracy', score: 75, notes: 'notes', created_at: '2026-01-02T00:00:00Z' };
const summaryRow = { summary_id: 'sum1', student_id: 's1', content: 'fresh', generated_at: '2026-01-02T00:00:00Z' };
const recRow = { recommendation_id: 'rec1', summary_id: 'sum1', content: 'advice', generated_at: '2026-01-02T00:00:00Z' };
const prefRow = { parent_id: 'p1', enabled: true, frequency: 'Weekly', recipient_email: 'parent@example.com' };
const parentRow = { parent_id: 'p1', auth_user_id: 'auth1', name: 'Pat', email: 'parent@example.com', mobile_number: '91234567' };
const studentRow = { student_id: 's1', name: 'Amy', date_of_birth: '2015-01-01', band_level: 'Band A' };
const dbError = { error: { message: 'down' } };

function expectCall(calls: { method: string; args: unknown[] }[], method: string, ...args: unknown[]) {
    expect(calls).toContainEqual({ method, args });
}

describe('repositories use immediate fluent Supabase chains', () => {
    it.each([
        [
            'UT-DAS7-U04-03',
            [
                progressRow,
                { ...progressRow, record_id: 'r2' },
                { ...progressRow, record_id: 'r3' },
            ],
        ],
    ])('%s maps progress rows in order', async (_id, rows) => {
        const f = fakeClient({ data: rows, error: null });

        await expect(createProgressRepo(f.client).listByStudent('s1')).resolves.toHaveLength(rows.length);
        expectCall(f.calls, 'order', 'date', { ascending: true });
    });
    it('UT-DAS7-U04-04 progress query failure normalises db error', async () => {
        const f = fakeClient(dbError);

        await expect(createProgressRepo(f.client).listByStudent('s1')).rejects.toThrow('db: down');
    });
    it.each([
        ['UT-DAS7-U06-01', null],
        ['UT-DAS7-U06-02', summaryRow],
    ])('%s returns latest summary or null', async (_id, data) => {
        const f = fakeClient({ data, error: null });

        await expect(createSummaryRepo(f.client).latestByStudent('s1')).resolves.toEqual(
            data ? rowToSummary(summaryRow) : null,
        );
        expectCall(f.calls, 'order', 'generated_at', { ascending: false });
    });
    it('UT-DAS7-U08-01 summary insert maps row and payload', async () => {
        const f = fakeClient({ data: summaryRow, error: null });

        await expect(
            createSummaryRepo(f.client).insert({ studentId: 's1', content: 'fresh' }),
        ).resolves.toEqual(rowToSummary(summaryRow));
        expectCall(f.calls, 'insert', { student_id: 's1', content: 'fresh' });
        expectCall(f.calls, 'single');
    });
    it('UT-DAS7-U11-01 recommendation insert maps row', async () => {
        const f = fakeClient({ data: recRow, error: null });

        await expect(
            createRecommendationRepo(f.client).insert({ summaryId: 'sum1', content: 'advice' }),
        ).resolves.toEqual(rowToRecommendation(recRow));
        expectCall(f.calls, 'insert', { summary_id: 'sum1', content: 'advice' });
    });
    it('UT-DAS7-U14-01 preference upsert maps row and conflict', async () => {
        const f = fakeClient({ data: prefRow, error: null });

        await expect(
            createPreferenceRepo(f.client).upsert(rowToPreference(prefRow)),
        ).resolves.toEqual(rowToPreference(prefRow));
        expectCall(
            f.calls,
            'upsert',
            { parent_id: 'p1', enabled: true, frequency: 'Weekly', recipient_email: 'parent@example.com' },
            { onConflict: 'parent_id' },
        );
    });
    it.each([
        [
            'UT-DAS7-U18-03',
            [prefRow, { ...prefRow, parent_id: 'p2' }, { ...prefRow, parent_id: 'p3' }],
        ],
    ])('%s maps enabled preferences', async (_id, rows) => {
        const f = fakeClient({ data: rows, error: null });

        await expect(createPreferenceRepo(f.client).listEnabled()).resolves.toHaveLength(rows.length);
        expectCall(f.calls, 'eq', 'enabled', true);
    });
    it.each([
        ['UT-DAS7-U19-01', null],
        ['UT-DAS7-U19-02', { sent_at: 'x' }],
    ])('%s maps prior notification timestamp', async (_id, data) => {
        const f = fakeClient({ data, error: null });

        await expect(createEmailNotificationRepo(f.client).lastSentAt('p1')).resolves.toBe(
            data?.sent_at ?? null,
        );
        expectCall(f.calls, 'order', 'sent_at', { ascending: false });
    });
    it.each([['UT-DAS7-U22-02', prefRow]])('%s maps preference by parent', async (_id, data) => {
        const f = fakeClient({ data, error: null });

        await expect(createPreferenceRepo(f.client).byParentId('p1')).resolves.toEqual(
            data ? rowToPreference(prefRow) : null,
        );
        expectCall(f.calls, 'maybeSingle');
    });
    it.each([['UT-DAS7-U27-01', 'sum1']])('%s writes email notification summary ID %s', async (_id, summaryId) => {
        const f = fakeClient({ error: null });

        await expect(
            createEmailNotificationRepo(f.client).insert({
                parentId: 'p1',
                summaryId,
                recipientEmail: 'x@y.com',
                subject: 's',
                body: 'b',
            }),
        ).resolves.toBeUndefined();
        expectCall(f.calls, 'insert', {
            parent_id: 'p1',
            summary_id: summaryId,
            recipient_email: 'x@y.com',
            subject: 's',
            body: 'b',
        });
    });
});

describe('parent and student repositories', () => {
    it.each([['UT-DAS7-U23-03', [{ student_id: 's1' }]]] as const)(
        '%s parent by ID maps links',
        async (_id, links) => {
            const f = fakeClient(
                { data: parentRow, error: null },
                { data: links, error: null },
            );

            await expect(createParentRepo(f.client).byId('p1')).resolves.toEqual(
                rowToParent(parentRow, links.map((x) => x.student_id)),
            );
        },
    );
    it.each([
        [
            'UT-DAS7-U24-03',
            [{ student_id: 's1' }, { student_id: 's2' }, { student_id: 's3' }],
            [
                studentRow,
                { ...studentRow, student_id: 's2' },
                { ...studentRow, student_id: 's3' },
            ],
        ],
    ])('%s lists parent students', async (_id, links, rows) => {
        const f = fakeClient(
            { data: links, error: null },
            { data: rows, error: null },
        );

        await expect(createStudentRepo(f.client).listByParent('p1')).resolves.toHaveLength(rows.length);
        expectCall(f.calls, 'in', 'student_id', links.map((x) => x.student_id));
    });
});
