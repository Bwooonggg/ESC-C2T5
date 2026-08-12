// @ts-nocheck -- fluent Supabase fake deliberately models runtime query chaining.
import { createProgressRepo } from '../../src/repos/progress.repo.js';
import { jest } from '@jest/globals';
import { createSummaryRepo } from '../../src/repos/summary.repo.js';
import { createRecommendationRepo } from '../../src/repos/recommendation.repo.js';
import { createPreferenceRepo } from '../../src/repos/preference.repo.js';
import { createEmailNotificationRepo } from '../../src/repos/emailNotification.repo.js';
import { createParentRepo } from '../../src/repos/parent.repo.js';
import { createStudentRepo } from '../../src/repos/student.repo.js';
import { rowToParent, rowToPreference, rowToProgressRecord, rowToRecommendation, rowToStudent, rowToSummary } from '../../src/repos/mappers.js';
import { fakeClient } from './helpers.js';

const progressRow = { record_id: 'r1', student_id: 's1', date: '2026-01-01', skill_area: 'Reading Accuracy', score: 75, notes: 'notes', created_at: '2026-01-02T00:00:00Z' };
const summaryRow = { summary_id: 'sum1', student_id: 's1', content: 'fresh', generated_at: '2026-01-02T00:00:00Z' };
const recRow = { recommendation_id: 'rec1', summary_id: 'sum1', content: 'advice', generated_at: '2026-01-02T00:00:00Z' };
const prefRow = { parent_id: 'p1', enabled: true, frequency: 'Weekly', recipient_email: 'parent@example.com' };
const parentRow = { parent_id: 'p1', auth_user_id: 'auth1', name: 'Pat', email: 'parent@example.com', mobile_number: '91234567' };
const studentRow = { student_id: 's1', name: 'Amy', date_of_birth: '2015-01-01', band_level: 'Band A' };
const dbError = { error: { message: 'down' } };

function expectCall(calls: { method: string; args: unknown[] }[], method: string, ...args: unknown[]) { expect(calls).toContainEqual({ method, args }); }

describe('repositories use immediate fluent Supabase chains', () => {
    it.each([['UT-DAS7-U04-01', []], ['UT-DAS7-U04-02', [progressRow]], ['UT-DAS7-U04-03', [progressRow, { ...progressRow, record_id: 'r2' }, { ...progressRow, record_id: 'r3' }]]])('%s maps progress rows in order', async (_id, rows) => { const f = fakeClient({ data: rows, error: null }); await expect(createProgressRepo(f.client).listByStudent('s1')).resolves.toHaveLength(rows.length); expectCall(f.calls, 'order', 'date', { ascending: true }); });
    it('UT-DAS7-U04-04 progress query failure normalises db error', async () => { const f = fakeClient(dbError); await expect(createProgressRepo(f.client).listByStudent('s1')).rejects.toThrow('db: down'); });
    it.each([['UT-DAS7-U05-01', null], ['UT-DAS7-U05-02', { created_at: 'x' }]])('%s returns latest created timestamp', async (_id, data) => { const f = fakeClient({ data, error: null }); await expect(createProgressRepo(f.client).latestCreatedAt('s1')).resolves.toBe(data?.created_at ?? null); expectCall(f.calls, 'limit', 1); expectCall(f.calls, 'maybeSingle'); });
    it('UT-DAS7-U05-03 latest timestamp error', async () => { const f = fakeClient(dbError); await expect(createProgressRepo(f.client).latestCreatedAt('s1')).rejects.toThrow('db: down'); });
    it.each([['UT-DAS7-U06-01', null], ['UT-DAS7-U06-02', summaryRow]])('%s returns latest summary or null', async (_id, data) => { const f = fakeClient({ data, error: null }); await expect(createSummaryRepo(f.client).latestByStudent('s1')).resolves.toEqual(data ? rowToSummary(summaryRow) : null); expectCall(f.calls, 'order', 'generated_at', { ascending: false }); });
    it('UT-DAS7-U06-03 summary query failure', async () => { const f = fakeClient(dbError); await expect(createSummaryRepo(f.client).latestByStudent('s1')).rejects.toThrow('db: down'); });
    it('UT-DAS7-U08-01 summary insert maps row and payload', async () => { const f = fakeClient({ data: summaryRow, error: null }); await expect(createSummaryRepo(f.client).insert({ studentId: 's1', content: 'fresh' })).resolves.toEqual(rowToSummary(summaryRow)); expectCall(f.calls, 'insert', { student_id: 's1', content: 'fresh' }); expectCall(f.calls, 'single'); });
    it('UT-DAS7-U08-02 summary insert failure', async () => { const f = fakeClient(dbError); await expect(createSummaryRepo(f.client).insert({ studentId: 's1', content: 'fresh' })).rejects.toThrow('db: down'); });
    it('UT-DAS7-U11-01 recommendation insert maps row', async () => { const f = fakeClient({ data: recRow, error: null }); await expect(createRecommendationRepo(f.client).insert({ summaryId: 'sum1', content: 'advice' })).resolves.toEqual(rowToRecommendation(recRow)); expectCall(f.calls, 'insert', { summary_id: 'sum1', content: 'advice' }); });
    it('UT-DAS7-U11-02 recommendation insert failure', async () => { const f = fakeClient(dbError); await expect(createRecommendationRepo(f.client).insert({ summaryId: 'sum1', content: 'advice' })).rejects.toThrow('db: down'); });
    it('UT-DAS7-U14-01 preference upsert maps row and conflict', async () => { const f = fakeClient({ data: prefRow, error: null }); await expect(createPreferenceRepo(f.client).upsert(rowToPreference(prefRow))).resolves.toEqual(rowToPreference(prefRow)); expectCall(f.calls, 'upsert', { parent_id: 'p1', enabled: true, frequency: 'Weekly', recipient_email: 'parent@example.com' }, { onConflict: 'parent_id' }); });
    it('UT-DAS7-U14-02 preference upsert failure', async () => { const f = fakeClient(dbError); await expect(createPreferenceRepo(f.client).upsert(rowToPreference(prefRow))).rejects.toThrow('db: down'); });
    it.each([['UT-DAS7-U18-01', []], ['UT-DAS7-U18-02', [prefRow]], ['UT-DAS7-U18-03', [prefRow, { ...prefRow, parent_id: 'p2' }, { ...prefRow, parent_id: 'p3' }]]])('%s maps enabled preferences', async (_id, rows) => { const f = fakeClient({ data: rows, error: null }); await expect(createPreferenceRepo(f.client).listEnabled()).resolves.toHaveLength(rows.length); expectCall(f.calls, 'eq', 'enabled', true); });
    it('UT-DAS7-U18-04 enabled preferences failure', async () => { const f = fakeClient(dbError); await expect(createPreferenceRepo(f.client).listEnabled()).rejects.toThrow('db: down'); });
    it.each([['UT-DAS7-U19-01', null], ['UT-DAS7-U19-02', { sent_at: 'x' }]])('%s maps prior notification timestamp', async (_id, data) => { const f = fakeClient({ data, error: null }); await expect(createEmailNotificationRepo(f.client).lastSentAt('p1')).resolves.toBe(data?.sent_at ?? null); expectCall(f.calls, 'order', 'sent_at', { ascending: false }); });
    it('UT-DAS7-U19-03 prior notification failure', async () => { const f = fakeClient(dbError); await expect(createEmailNotificationRepo(f.client).lastSentAt('p1')).rejects.toThrow('db: down'); });
    it.each([['UT-DAS7-U22-01', null], ['UT-DAS7-U22-02', prefRow]])('%s maps preference by parent', async (_id, data) => { const f = fakeClient({ data, error: null }); await expect(createPreferenceRepo(f.client).byParentId('p1')).resolves.toEqual(data ? rowToPreference(prefRow) : null); expectCall(f.calls, 'maybeSingle'); });
    it('UT-DAS7-U22-03 preference query failure', async () => { const f = fakeClient(dbError); await expect(createPreferenceRepo(f.client).byParentId('p1')).rejects.toThrow('db: down'); });
    it.each([['UT-DAS7-U27-01', 'sum1'], ['UT-DAS7-U27-02', null]])('%s writes email notification summary ID %s', async (_id, summaryId) => { const f = fakeClient({ error: null }); await expect(createEmailNotificationRepo(f.client).insert({ parentId: 'p1', summaryId, recipientEmail: 'x@y.com', subject: 's', body: 'b' })).resolves.toBeUndefined(); expectCall(f.calls, 'insert', { parent_id: 'p1', summary_id: summaryId, recipient_email: 'x@y.com', subject: 's', body: 'b' }); });
    it('UT-DAS7-U27-03 email notification insert failure', async () => { const f = fakeClient(dbError); await expect(createEmailNotificationRepo(f.client).insert({ parentId: 'p1', summaryId: null, recipientEmail: 'x@y.com', subject: 's', body: 'b' })).rejects.toThrow('db: down'); });
});

describe('parent and student repositories', () => {
    const parentCases = [['UT-DAS7-U23-02', []], ['UT-DAS7-U23-03', [{ student_id: 's1' }]], ['UT-DAS7-U23-04', [{ student_id: 's1' }, { student_id: 's2' }, { student_id: 's3' }]]] as const;
    it('UT-DAS7-U23-01 absent parent avoids link query', async () => { const f = fakeClient({ data: null, error: null }); await expect(createParentRepo(f.client).byId('p1')).resolves.toBeNull(); expect(f.calls.filter(x => x.method === 'from')).toHaveLength(1); });
    it.each(parentCases)('%s parent by ID maps links', async (_id, links) => { const f = fakeClient({ data: parentRow, error: null }, { data: links, error: null }); await expect(createParentRepo(f.client).byId('p1')).resolves.toEqual(rowToParent(parentRow, links.map(x => x.student_id))); });
    it('UT-DAS7-U23-05 parent query failure skips links', async () => { const f = fakeClient(dbError); await expect(createParentRepo(f.client).byId('p1')).rejects.toThrow('db: down'); expect(f.calls.filter(x => x.method === 'from')).toHaveLength(1); });
    it('UT-DAS7-U23-06 parent link failure propagates', async () => { const f = fakeClient({ data: parentRow, error: null }, dbError); await expect(createParentRepo(f.client).byId('p1')).rejects.toThrow('db: down'); });
    it('UT-DAS7-U31-01 absent auth parent avoids links', async () => { const f = fakeClient({ data: null, error: null }); await expect(createParentRepo(f.client).byAuthUserId('auth1')).resolves.toBeNull(); });
    it.each([['UT-DAS7-U31-02', []], ['UT-DAS7-U31-03', [{ student_id: 's1' }]], ['UT-DAS7-U31-04', [{ student_id: 's1' }, { student_id: 's2' }, { student_id: 's3' }]]])('%s auth parent maps links', async (_id, links) => { const f = fakeClient({ data: parentRow, error: null }, { data: links, error: null }); await expect(createParentRepo(f.client).byAuthUserId('auth1')).resolves.toEqual(rowToParent(parentRow, links.map(x => x.student_id))); });
    it('UT-DAS7-U31-05 auth parent failure', async () => { const f = fakeClient(dbError); await expect(createParentRepo(f.client).byAuthUserId('auth1')).rejects.toThrow('db: down'); });
    it('UT-DAS7-U31-06 auth parent links failure', async () => { const f = fakeClient({ data: parentRow, error: null }, dbError); await expect(createParentRepo(f.client).byAuthUserId('auth1')).rejects.toThrow('db: down'); });
    it.each([['UT-DAS7-U24-01', [], []], ['UT-DAS7-U24-02', [{ student_id: 's1' }], [studentRow]], ['UT-DAS7-U24-03', [{ student_id: 's1' }, { student_id: 's2' }, { student_id: 's3' }], [studentRow, { ...studentRow, student_id: 's2' }, { ...studentRow, student_id: 's3' }]]])('%s lists parent students', async (_id, links, rows) => { const f = fakeClient({ data: links, error: null }, { data: rows, error: null }); await expect(createStudentRepo(f.client).listByParent('p1')).resolves.toHaveLength(rows.length); if (links.length) expectCall(f.calls, 'in', 'student_id', links.map(x => x.student_id)); });
    it('UT-DAS7-U24-04 link query failure skips student query', async () => { const f = fakeClient(dbError); await expect(createStudentRepo(f.client).listByParent('p1')).rejects.toThrow('db: down'); });
    it('UT-DAS7-U24-05 student query failure', async () => { const f = fakeClient({ data: [{ student_id: 's1' }], error: null }, dbError); await expect(createStudentRepo(f.client).listByParent('p1')).rejects.toThrow('db: down'); });
    it.each([['UT-DAS7-U25-01', null], ['UT-DAS7-U25-02', studentRow]])('%s gets student or null', async (_id, data) => { const f = fakeClient({ data, error: null }); await expect(createStudentRepo(f.client).byId('s1')).resolves.toEqual(data ? rowToStudent(studentRow) : null); });
    it('UT-DAS7-U25-03 student query failure', async () => { const f = fakeClient(dbError); await expect(createStudentRepo(f.client).byId('s1')).rejects.toThrow('db: down'); });
    it.each([['UT-DAS7-U30-01', { student_id: 's1' }, true], ['UT-DAS7-U30-02', null, false]])('%s resolves guardianship', async (_id, data, expected) => { const f = fakeClient({ data, error: null }); await expect(createStudentRepo(f.client).isGuardian('p1', 's1')).resolves.toBe(expected); expectCall(f.calls, 'eq', 'parent_id', 'p1'); expectCall(f.calls, 'eq', 'student_id', 's1'); });
    it('UT-DAS7-U30-03 guardianship failure', async () => { const f = fakeClient(dbError); await expect(createStudentRepo(f.client).isGuardian('p1', 's1')).rejects.toThrow('db: down'); });
});

describe('row mappers', () => {
    it('UT-DAS7-U32-01 maps parent fields and preserves student ID order', () => { const ids = ['s1', 's2', 's3']; expect(rowToParent(parentRow, ids)).toEqual({ parentId: 'p1', name: 'Pat', email: 'parent@example.com', mobileNumber: '91234567', studentIds: ids }); });
    it('UT-DAS7-U32-02 maps student', () => expect(rowToStudent(studentRow)).toEqual({ studentId: 's1', name: 'Amy', dateOfBirth: '2015-01-01', bandLevel: 'Band A' }));
    it('UT-DAS7-U32-03 maps progress without created_at', () => expect(rowToProgressRecord(progressRow)).toEqual({ recordId: 'r1', studentId: 's1', date: '2026-01-01', skillArea: 'Reading Accuracy', score: 75, notes: 'notes' }));
    it('UT-DAS7-U32-04 maps summary', () => expect(rowToSummary(summaryRow)).toEqual({ summaryId: 'sum1', studentId: 's1', content: 'fresh', generatedAt: '2026-01-02T00:00:00Z' }));
    it('UT-DAS7-U32-05 maps recommendation', () => expect(rowToRecommendation(recRow)).toEqual({ recommendationId: 'rec1', summaryId: 'sum1', content: 'advice', generatedAt: '2026-01-02T00:00:00Z' }));
    it('UT-DAS7-U32-06 maps a representative preference', () => expect(rowToPreference(prefRow)).toEqual({ parentId: 'p1', frequency: 'Weekly', enabled: true, recipientEmail: 'parent@example.com' }));
});
