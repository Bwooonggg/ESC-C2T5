import type { AppConfig } from '../../src/config.js';
import type {
    EmailNotificationRepo, InsightService, ParentRepo, PreferenceRepo, StudentRepo,
} from '../../src/deps.js';
import type {
    NotificationPreference, Parent, Recommendation, ProgressRecord, Student, Summary,
} from '../../src/types.js';
import { UnavailableError } from '../../src/errors.js';
import { FakeEmailProvider } from '../../src/adapters/email/fake-email.js';
import { createNotifierService, isDue } from '../../src/services/notifier.service.js';

// ---------------------------------------------------------------------------
// In-file fakes — nothing from src/repos/ is imported here.
// ---------------------------------------------------------------------------

const INTERVALS = { Weekly: 1000, Fortnightly: 2000, Monthly: 4000 } as const;

const config = {
    nodeEnv: 'test',
    port: 4000,
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'service-role-key',
    supabaseDbSchema: 'insight',
    supabaseJwksUrl: 'https://example.supabase.co/auth/v1/.well-known/jwks.json',
    llmProvider: 'stub',
    llmApiKey: null,
    llmModel: null,
    llmTimeoutMs: 10000,
    emailProvider: 'fake',
    brevoApiKey: null,
    emailFrom: null,
    schedulerEnabled: false,
    schedulerTickMs: 1000,
    notifyIntervalsMs: { ...INTERVALS },
} satisfies AppConfig;

class FakePreferenceRepo implements PreferenceRepo {
    readonly prefs = new Map<string, NotificationPreference>();

    async byParentId(parentId: string): Promise<NotificationPreference | null> {
        return this.prefs.get(parentId) ?? null;
    }

    async upsert(pref: NotificationPreference): Promise<NotificationPreference> {
        this.prefs.set(pref.parentId, pref);
        return pref;
    }

    async listEnabled(): Promise<NotificationPreference[]> {
        return [...this.prefs.values()].filter(p => p.enabled);
    }
}

class FakeParentRepo implements ParentRepo {
    readonly parents = new Map<string, Parent>();

    async byAuthUserId(): Promise<Parent | null> { return null; }

    async byId(parentId: string): Promise<Parent | null> {
        return this.parents.get(parentId) ?? null;
    }
}

class FakeStudentRepo implements StudentRepo {
    readonly byParent = new Map<string, Student[]>();

    async byId(studentId: string): Promise<Student | null> {
        for (const students of this.byParent.values()) {
            const hit = students.find(s => s.studentId === studentId);
            if (hit) return hit;
        }
        return null;
    }

    async listByParent(parentId: string): Promise<Student[]> {
        return this.byParent.get(parentId) ?? [];
    }

    async isGuardian(parentId: string, studentId: string): Promise<boolean> {
        return (this.byParent.get(parentId) ?? []).some(s => s.studentId === studentId);
    }
}

interface RecordedNotification {
    parentId: string;
    summaryId: string | null;
    recipientEmail: string;
    subject: string;
    body: string;
}

class FakeEmailNotificationRepo implements EmailNotificationRepo {
    readonly rows: RecordedNotification[] = [];
    readonly sentAt = new Map<string, string>();
    /** When set, insert() rejects with this error. */
    insertError: Error | null = null;

    async lastSentAt(parentId: string): Promise<string | null> {
        return this.sentAt.get(parentId) ?? null;
    }

    async insert(input: RecordedNotification): Promise<void> {
        if (this.insertError !== null) throw this.insertError;
        this.rows.push(input);
    }
}

class FakeInsightService implements InsightService {
    /** studentId → canned summary content, or an Error to throw for that student. */
    readonly summaries = new Map<string, string | Error>();

    async trackProgress(): Promise<{ progress: ProgressRecord[]; summary: Summary }> {
        throw new Error('not used');
    }

    async getSummary(studentId: string): Promise<Summary> {
        const canned = this.summaries.get(studentId);
        if (canned === undefined) throw new UnavailableError('summaryUnavailable');
        if (canned instanceof Error) throw canned;
        return {
            summaryId: `summary-${studentId}`,
            studentId,
            content: canned,
            generatedAt: '2026-01-01T00:00:00.000Z',
        };
    }

    async createRecommendation(): Promise<Recommendation> {
        throw new Error('not used');
    }
}

function student(studentId: string, name: string): Student {
    return { studentId, name, dateOfBirth: '2015-05-05', bandLevel: 'Band A' };
}

function parent(parentId: string, studentIds: string[]): Parent {
    return {
        parentId,
        name: `Parent ${parentId}`,
        email: `${parentId}@test.dev`,
        mobileNumber: '+6591234567',
        studentIds,
    };
}

/**
 * Wires the fakes into a notifier. By default: parent `p1` with two students
 * (`s1`, `s2`), both with summaries, and an enabled Weekly preference.
 */
function setup() {
    const preferenceRepo = new FakePreferenceRepo();
    const parentRepo = new FakeParentRepo();
    const studentRepo = new FakeStudentRepo();
    const emailNotificationRepo = new FakeEmailNotificationRepo();
    const insightService = new FakeInsightService();
    const email = new FakeEmailProvider();

    parentRepo.parents.set('p1', parent('p1', ['s1', 's2']));
    studentRepo.byParent.set('p1', [student('s1', 'Ada'), student('s2', 'Grace')]);
    insightService.summaries.set('s1', 'Ada is improving.');
    insightService.summaries.set('s2', 'Grace is steady.');
    preferenceRepo.prefs.set('p1', {
        parentId: 'p1', enabled: true, frequency: 'Weekly', recipientEmail: 'notify@test.dev',
    });

    const notifier = createNotifierService({
        preferenceRepo, parentRepo, studentRepo, emailNotificationRepo,
        insightService, email, config,
    });

    return {
        notifier, preferenceRepo, parentRepo, studentRepo,
        emailNotificationRepo, insightService, email,
    };
}

const NOW = new Date('2026-07-29T00:00:00.000Z');

describe('isDue', () => {
    it('is true when nothing was ever sent', () => {
        expect(isDue(null, 'Weekly', NOW, INTERVALS)).toBe(true);
    });

    it('is true once the interval has fully elapsed', () => {
        const last = new Date(NOW.getTime() - INTERVALS.Weekly).toISOString();

        expect(isDue(last, 'Weekly', NOW, INTERVALS)).toBe(true);
    });

    it('is false while the interval has not elapsed', () => {
        const last = new Date(NOW.getTime() - (INTERVALS.Weekly - 1)).toISOString();

        expect(isDue(last, 'Weekly', NOW, INTERVALS)).toBe(false);
    });

    it('uses each frequency\'s own interval', () => {
        const last = new Date(NOW.getTime() - 2500).toISOString();

        expect(isDue(last, 'Weekly', NOW, INTERVALS)).toBe(true);        // 2500 >= 1000
        expect(isDue(last, 'Fortnightly', NOW, INTERVALS)).toBe(true);   // 2500 >= 2000
        expect(isDue(last, 'Monthly', NOW, INTERVALS)).toBe(false);      // 2500 <  4000
    });
});

describe('notifyParent', () => {
    const realConsoleError = console.error;
    let logged: unknown[][] = [];

    beforeEach(() => {
        logged = [];
        console.error = (...args: unknown[]) => { logged.push(args); };
    });

    afterEach(() => {
        console.error = realConsoleError;
    });

    it('sends one email covering every student and records it', async () => {
        const { notifier, email, emailNotificationRepo } = setup();

        const outcome = await notifier.notifyParent('p1', NOW);

        expect(outcome).toBe('parentNotified');
        expect(email.history).toHaveLength(1);
        expect(email.history[0].to).toBe('notify@test.dev');
        expect(email.history[0].subject).toContain('Ada');
        expect(email.history[0].subject).toContain('Grace');
        expect(email.history[0].body).toBe('Ada:\nAda is improving.\n\nGrace:\nGrace is steady.');
        expect(emailNotificationRepo.rows).toEqual([{
            parentId: 'p1',
            summaryId: 'summary-s1',
            recipientEmail: 'notify@test.dev',
            subject: email.history[0].subject,
            body: email.history[0].body,
        }]);
    });

    it('fails without sending when the preference is disabled', async () => {
        const { notifier, preferenceRepo, email, emailNotificationRepo } = setup();
        preferenceRepo.prefs.set('p1', {
            parentId: 'p1', enabled: false, frequency: 'Weekly', recipientEmail: 'notify@test.dev',
        });

        const outcome = await notifier.notifyParent('p1', NOW);

        expect(outcome).toBe('notificationFailed');
        expect(email.history).toHaveLength(0);
        expect(emailNotificationRepo.rows).toHaveLength(0);
    });

    it('fails without sending when there is no preference at all', async () => {
        const { notifier, preferenceRepo, email } = setup();
        preferenceRepo.prefs.delete('p1');

        expect(await notifier.notifyParent('p1', NOW)).toBe('notificationFailed');
        expect(email.history).toHaveLength(0);
    });

    it('fails when the parent has no students', async () => {
        const { notifier, studentRepo, email } = setup();
        studentRepo.byParent.set('p1', []);

        expect(await notifier.notifyParent('p1', NOW)).toBe('notificationFailed');
        expect(email.history).toHaveLength(0);
    });

    it('fails when a student has no progress to summarise (IT7B-05 shape)', async () => {
        const { notifier, insightService, email, emailNotificationRepo } = setup();
        insightService.summaries.set('s2', new UnavailableError('progressUnavailable'));

        const outcome = await notifier.notifyParent('p1', NOW);

        expect(outcome).toBe('notificationFailed');
        expect(email.history).toHaveLength(0);
        expect(emailNotificationRepo.rows).toHaveLength(0);
        expect(logged).toHaveLength(1);
    });

    it('fails when summary generation is unavailable (IT7B-04 shape)', async () => {
        const { notifier, insightService, email, emailNotificationRepo } = setup();
        insightService.summaries.set('s1', new UnavailableError('summaryUnavailable'));

        const outcome = await notifier.notifyParent('p1', NOW);

        expect(outcome).toBe('notificationFailed');
        expect(email.history).toHaveLength(0);
        expect(emailNotificationRepo.rows).toHaveLength(0);
    });

    it('fails and records nothing when the email provider is down (IT7B-02 shape)', async () => {
        const { notifier, email, emailNotificationRepo } = setup();
        email.mode = 'fail';

        const outcome = await notifier.notifyParent('p1', NOW);

        expect(outcome).toBe('notificationFailed');
        expect(email.history).toHaveLength(0);
        expect(emailNotificationRepo.rows).toHaveLength(0);
    });

    it('still reports success when recording the sent email fails', async () => {
        const { notifier, email, emailNotificationRepo } = setup();
        emailNotificationRepo.insertError = new Error('insert exploded');

        const outcome = await notifier.notifyParent('p1', NOW);

        expect(outcome).toBe('parentNotified');
        expect(email.history).toHaveLength(1);
        expect(emailNotificationRepo.rows).toHaveLength(0);
        expect(logged).toHaveLength(1);
    });
});

describe('runDueNotifications', () => {
    const realConsoleError = console.error;

    beforeEach(() => { console.error = () => {}; });
    afterEach(() => { console.error = realConsoleError; });

    /** Adds a second parent `p2` with one student and an enabled preference. */
    function addSecondParent(ctx: ReturnType<typeof setup>) {
        ctx.parentRepo.parents.set('p2', parent('p2', ['s3']));
        ctx.studentRepo.byParent.set('p2', [student('s3', 'Linus')]);
        ctx.insightService.summaries.set('s3', 'Linus is progressing.');
        ctx.preferenceRepo.prefs.set('p2', {
            parentId: 'p2', enabled: true, frequency: 'Weekly', recipientEmail: 'p2@test.dev',
        });
    }

    it('notifies only the parents whose interval has elapsed', async () => {
        const ctx = setup();
        addSecondParent(ctx);
        // p1 was emailed a moment ago; p2 has never been emailed.
        ctx.emailNotificationRepo.sentAt.set('p1', new Date(NOW.getTime() - 10).toISOString());

        const results = await ctx.notifier.runDueNotifications(NOW);

        expect(results).toEqual([{ parentId: 'p2', outcome: 'parentNotified' }]);
        expect(ctx.email.history.map(e => e.to)).toEqual(['p2@test.dev']);
    });

    it('skips disabled preferences entirely', async () => {
        const ctx = setup();
        addSecondParent(ctx);
        ctx.preferenceRepo.prefs.set('p1', {
            parentId: 'p1', enabled: false, frequency: 'Weekly', recipientEmail: 'notify@test.dev',
        });

        const results = await ctx.notifier.runDueNotifications(NOW);

        expect(results).toEqual([{ parentId: 'p2', outcome: 'parentNotified' }]);
    });

    it('keeps going after a parent fails, and reports both outcomes', async () => {
        const ctx = setup();
        addSecondParent(ctx);
        ctx.insightService.summaries.set('s1', new UnavailableError('progressUnavailable'));

        const results = await ctx.notifier.runDueNotifications(NOW);

        expect(results).toEqual([
            { parentId: 'p1', outcome: 'notificationFailed' },
            { parentId: 'p2', outcome: 'parentNotified' },
        ]);
        expect(ctx.email.history.map(e => e.to)).toEqual(['p2@test.dev']);
    });

    it('returns an empty list when nothing is enabled', async () => {
        const ctx = setup();
        ctx.preferenceRepo.prefs.clear();

        expect(await ctx.notifier.runDueNotifications(NOW)).toEqual([]);
        expect(ctx.email.history).toHaveLength(0);
    });
});
