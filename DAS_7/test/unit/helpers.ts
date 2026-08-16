// @ts-nocheck -- Jest's ESM mock typings cannot represent fluent Supabase chains.
import type { AppConfig } from '../../src/config.js';
import { jest } from '@jest/globals';
import type { Deps } from '../../src/deps.js';
import type { Parent, ProgressRecord, Student, Summary, NotificationPreference } from '../../src/types.js';

export const parent: Parent = {
    parentId: 'p1', name: 'Pat Parent', email: 'parent@example.com', mobileNumber: '91234567', studentIds: ['s1'],
};
export const student: Student = {
    studentId: 's1', name: 'Amy', dateOfBirth: '2015-01-01', bandLevel: 'Band A',
};
export const record: ProgressRecord = {
    recordId: 'r1', studentId: 's1', date: '2026-01-01', skillArea: 'Reading Accuracy', score: 75, notes: 'Practised blends',
};
export const summary: Summary = {
    summaryId: 'sum1', studentId: 's1', content: 'Amy is progressing.', generatedAt: '2026-01-02T00:00:00.000Z',
};
export const preference: NotificationPreference = {
    parentId: 'p1', enabled: true, frequency: 'Weekly', recipientEmail: 'parent@example.com',
};

export const config: AppConfig = {
    nodeEnv: 'test',
    port: 3000,
    supabaseUrl: 'https://project.supabase.co',
    supabaseServiceRoleKey: 'service-key',
    supabaseDbSchema: 'insight',
    supabaseJwksUrl: 'https://project.supabase.co/auth/v1/.well-known/jwks.json',
    llmProvider: 'openrouter',
    llmApiKey: 'router-key',
    llmModel: 'model',
    llmTimeoutMs: 1000,
    emailProvider: 'brevo',
    brevoApiKey: 'brevo-key',
    emailFrom: 'noreply@example.com',
    schedulerEnabled: false,
    notifyIntervalsMs: { Weekly: 7 * 86400000, Fortnightly: 14 * 86400000, Monthly: 30 * 86400000 },
    schedulerTickMs: 60000,
};

export function mockDeps(): jest.Mocked<Deps> {
    return {
        config,
        parentRepo: { byAuthUserId: jest.fn(), byId: jest.fn() },
        studentRepo: { byId: jest.fn(), listByParent: jest.fn(), isGuardian: jest.fn() },
        progressRepo: { listByStudent: jest.fn(), latestCreatedAt: jest.fn() },
        summaryRepo: { latestByStudent: jest.fn(), insert: jest.fn() },
        recommendationRepo: { insert: jest.fn() },
        preferenceRepo: { byParentId: jest.fn(), upsert: jest.fn(), listEnabled: jest.fn() },
        emailNotificationRepo: { lastSentAt: jest.fn(), insert: jest.fn() },
        llm: { generateSummary: jest.fn(), generateRecommendation: jest.fn() },
        email: { send: jest.fn() },
        insightService: { trackProgress: jest.fn(), getSummary: jest.fn(), createRecommendation: jest.fn() },
        preferenceService: { get: jest.fn(), save: jest.fn() },
        notifierService: { notifyParent: jest.fn(), runDueNotifications: jest.fn() },
    };
}

export interface QueryCall {
    method: string;
    args: unknown[];
}
export function fakeClient(...results: Array<{ data?: unknown; error?: { message: string } | null }>) {
    const calls: QueryCall[] = [];
    let resultIndex = 0;
    const query = (): any => {
        const result = () => Promise.resolve(results[resultIndex++] ?? { data: null, error: null });
        const chain: any = {};
        for (const method of ['select', 'eq', 'order', 'limit', 'insert', 'upsert', 'in']) {
            chain[method] = (...args: unknown[]) => {
                calls.push({ method, args });
                return chain;
            };
        }
        chain.maybeSingle = () => {
            calls.push({ method: 'maybeSingle', args: [] });
            return result();
        };
        chain.single = () => {
            calls.push({ method: 'single', args: [] });
            return result();
        };
        chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => result().then(resolve, reject);
        return chain;
    };
    return {
        client: {
            from: (table: string) => {
                calls.push({ method: 'from', args: [table] });
                return query();
            },
        } as any,
        calls,
    };
}

export function response(content: string, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: jest.fn().mockResolvedValue({ choices: [{ message: { content } }] }),
    } as unknown as Response;
}
