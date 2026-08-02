/**
 * Integration harness: the real app — real Supabase repos, real JWT verification,
 * real routes — with exactly two boundaries faked (the LLM and the email provider),
 * as the test plan specifies. Everything it inserts is tracked and removed by
 * `cleanup()`, so the shared test project is left as it was found.
 *
 * Deliberately free of `jest` APIs apart from `describeIntegration`, so the file
 * can also be imported by a plain `tsx` script.
 */
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import type { AppConfig } from '../../src/config.js';
import { loadConfig } from '../../src/config.js';
import { createApp } from '../../src/app.js';
import type { Deps } from '../../src/deps.js';
import type { Parent, SkillArea, Student } from '../../src/types.js';
import { createDbClient } from '../../src/repos/db.js';
import { createParentRepo } from '../../src/repos/parent.repo.js';
import { createStudentRepo } from '../../src/repos/student.repo.js';
import { createProgressRepo } from '../../src/repos/progress.repo.js';
import { createSummaryRepo } from '../../src/repos/summary.repo.js';
import { createRecommendationRepo } from '../../src/repos/recommendation.repo.js';
import { createPreferenceRepo } from '../../src/repos/preference.repo.js';
import { createEmailNotificationRepo } from '../../src/repos/emailNotification.repo.js';
import { rowToParent, rowToStudent, type ParentRow, type StudentRow } from '../../src/repos/mappers.js';
import type { LlmClient } from '../../src/adapters/llm/llm-client.js';
import { LlmUnavailableError } from '../../src/adapters/llm/llm-client.js';
import { StubLlmClient } from '../../src/adapters/llm/stub-llm.js';
import type { SentEmail } from '../../src/adapters/email/email-provider.js';
import { FakeEmailProvider } from '../../src/adapters/email/fake-email.js';
import { createInsightService } from '../../src/services/insight.service.js';
import { createPreferenceService } from '../../src/services/preference.service.js';
import { createNotifierService } from '../../src/services/notifier.service.js';
import { signInTestUser } from './test-auth.js';

export interface LlmControl {
    mode: 'ok' | 'fail';          // 'fail' → every generate call throws LlmUnavailableError
    summaryCalls: number;         // incremented per generateSummary call
    recommendationCalls: number;
    reset(): void;                // mode='ok', counters=0
}

export interface FakeEmailControl {
    history: SentEmail[];         // successfully "sent" emails, in order
    mode: 'ok' | 'fail';          // 'fail' → send() throws EmailSendError
}

export interface TestHarness {
    app: Express;                 // real app: real Supabase repos, real auth, fakes below
    deps: Deps;                   // the exact deps the app was built with
    tokenA: string;               // real JWT for test parent A
    tokenB: string;               // real JWT for test parent B
    parentA: Parent;              // has studentA1 (with progress) and studentA2 (no progress)
    parentB: Parent;              // has studentB1 (no progress)
    studentA1: Student;
    studentA2: Student;
    studentB1: Student;
    llm: LlmControl;
    email: FakeEmailControl;
    /** Creates + registers an extra parent (no students, no preference, no auth user). */
    createParent(): Promise<Parent>;
    /** Creates + registers an extra student for cleanup. */
    createStudent(opts: { parentId: string; withProgress: boolean }): Promise<Student>;
    /** Deletes every row this harness created (cascades handle children). */
    cleanup(): Promise<void>;
}

export function integrationConfigured(): boolean {
    const url = process.env.SUPABASE_URL ?? '';
    const ref = process.env.TEST_SUPABASE_REF ?? '';
    return Boolean(url && ref && url.includes(ref) && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Suites created with this skip cleanly when integration env is not configured. */
export const describeIntegration: jest.Describe =
    integrationConfigured() ? describe : describe.skip;

/** Every parent row the harness writes carries this, so leftovers are recognisable. */
const HARNESS_PARENT_NAME = 'DAS7 integration harness parent';

/** Two skill areas over three dates: enough for a trend the stub can phrase. */
const PROGRESS_SKILL_AREAS: readonly SkillArea[] = ['Reading Accuracy', 'Spelling'];
const PROGRESS_DATES: readonly string[] = ['2026-01-12', '2026-02-16', '2026-03-15'];

/**
 * Wraps the deterministic stub so a suite can count generations and simulate an
 * outage. `mode: 'fail'` throws the error the insight service maps to a 503.
 */
class ControllableLlmClient implements LlmClient, LlmControl {
    mode: 'ok' | 'fail' = 'ok';
    summaryCalls = 0;
    recommendationCalls = 0;

    private readonly inner = new StubLlmClient();

    reset(): void {
        this.mode = 'ok';
        this.summaryCalls = 0;
        this.recommendationCalls = 0;
    }

    async generateSummary(
        input: Parameters<LlmClient['generateSummary']>[0],
    ): Promise<string> {
        this.summaryCalls += 1;
        if (this.mode === 'fail') throw new LlmUnavailableError('harness: llm forced to fail');
        return this.inner.generateSummary(input);
    }

    async generateRecommendation(
        input: Parameters<LlmClient['generateRecommendation']>[0],
    ): Promise<string> {
        this.recommendationCalls += 1;
        if (this.mode === 'fail') throw new LlmUnavailableError('harness: llm forced to fail');
        return this.inner.generateRecommendation(input);
    }
}

function requireEnv(key: string): string {
    const value = (process.env[key] ?? '').trim();
    if (value === '') throw new Error(`createHarness needs ${key} in the environment`);
    return value;
}

/** Rising scores so the stub reports an improvement rather than a flat line. */
function progressRowsFor(studentId: string): Array<Record<string, unknown>> {
    const rows: Array<Record<string, unknown>> = [];
    PROGRESS_SKILL_AREAS.forEach((skillArea, skillIndex) => {
        PROGRESS_DATES.forEach((date, roundIndex) => {
            rows.push({
                record_id: randomUUID(),
                student_id: studentId,
                date,
                skill_area: skillArea,
                score: 50 + skillIndex * 5 + roundIndex * 10,
                notes: `${skillArea} round ${roundIndex + 1}`,
            });
        });
    });
    return rows;
}

export async function createHarness(): Promise<TestHarness> {
    if (!integrationConfigured()) {
        throw new Error(
            'createHarness needs a configured test project: set SUPABASE_URL, '
            + 'SUPABASE_SERVICE_ROLE_KEY and TEST_SUPABASE_REF (the ref must appear in the URL).',
        );
    }

    // The dev fallback would let unauthenticated requests through as a fixed
    // parent, which is exactly what the auth suite is checking for.
    const config: AppConfig = { ...loadConfig(), authDevSub: null, emailProvider: 'fake' };
    const client = createDbClient(config);

    const parentRepo = createParentRepo(client);
    const studentRepo = createStudentRepo(client);
    const progressRepo = createProgressRepo(client);
    const summaryRepo = createSummaryRepo(client);
    const recommendationRepo = createRecommendationRepo(client);
    const preferenceRepo = createPreferenceRepo(client);
    const emailNotificationRepo = createEmailNotificationRepo(client);

    const llm = new ControllableLlmClient();
    const email = new FakeEmailProvider();

    const insightService = createInsightService({
        studentRepo, progressRepo, summaryRepo, recommendationRepo, llm,
    });
    const preferenceService = createPreferenceService({ preferenceRepo, parentRepo });
    const notifierService = createNotifierService({
        preferenceRepo, parentRepo, studentRepo, emailNotificationRepo,
        insightService, email, config,
    });

    const deps: Deps = {
        config,
        parentRepo, studentRepo, progressRepo, summaryRepo, recommendationRepo,
        preferenceRepo, emailNotificationRepo,
        llm, email,
        insightService, preferenceService, notifierService,
    };

    const app = createApp(deps);

    const parentIds: string[] = [];
    const studentIds: string[] = [];

    async function insertParent(authUserId: string | null): Promise<Parent> {
        const parentId = randomUUID();
        const { data, error } = await client
            .from('parents')
            .insert({
                parent_id: parentId,
                auth_user_id: authUserId,
                name: HARNESS_PARENT_NAME,
                email: `harness-${parentId}@test.dev`,
                mobile_number: '+65 8000 0000',
            })
            .select()
            .single();
        if (error) throw new Error(`harness: insert parent — ${error.message}`);
        parentIds.push(parentId);
        return rowToParent(data as ParentRow, []);
    }

    async function insertStudent(
        opts: { parentId: string; withProgress: boolean },
    ): Promise<Student> {
        const studentId = randomUUID();
        const inserted = await client
            .from('students')
            .insert({
                student_id: studentId,
                name: `Harness Student ${studentId.slice(0, 8)}`,
                date_of_birth: '2015-06-01',
                band_level: 'Band A',
            })
            .select()
            .single();
        if (inserted.error) throw new Error(`harness: insert student — ${inserted.error.message}`);
        studentIds.push(studentId);

        const link = await client
            .from('parent_students')
            .insert({ parent_id: opts.parentId, student_id: studentId });
        if (link.error) throw new Error(`harness: link guardianship — ${link.error.message}`);

        if (opts.withProgress) {
            const progress = await client
                .from('progress_records')
                .insert(progressRowsFor(studentId));
            if (progress.error) {
                throw new Error(`harness: insert progress — ${progress.error.message}`);
            }
        }

        return rowToStudent(inserted.data as StudentRow);
    }

    async function cleanup(): Promise<void> {
        // Parents first, then students: between them the cascades take the
        // guardianship links, progress, summaries, recommendations, preferences
        // and email notifications with them.
        const failures: string[] = [];

        if (parentIds.length > 0) {
            const { error } = await client.from('parents').delete().in('parent_id', parentIds);
            if (error) failures.push(`parents — ${error.message}`);
            else parentIds.length = 0;
        }
        if (studentIds.length > 0) {
            const { error } = await client.from('students').delete().in('student_id', studentIds);
            if (error) failures.push(`students — ${error.message}`);
            else studentIds.length = 0;
        }

        if (failures.length > 0) throw new Error(`harness: cleanup failed — ${failures.join('; ')}`);
    }

    // A crashed earlier run can leave a parent holding the test user's
    // auth_user_id, which is UNIQUE — drop our own leftovers, but never anyone else's.
    async function releaseAuthUser(authUserId: string): Promise<void> {
        const { data, error } = await client
            .from('parents')
            .select('parent_id, name')
            .eq('auth_user_id', authUserId)
            .maybeSingle();
        if (error) throw new Error(`harness: read parent by auth user — ${error.message}`);
        if (data === null) return;

        const stale = data as { parent_id: string; name: string };
        if (stale.name !== HARNESS_PARENT_NAME) {
            throw new Error(
                `harness: auth user ${authUserId} is already mapped to parent ${stale.parent_id},`
                + ' which this harness did not create. Point TEST_USER_* at dedicated test users.',
            );
        }

        const deleted = await client.from('parents').delete().eq('parent_id', stale.parent_id);
        if (deleted.error) {
            throw new Error(`harness: drop stale harness parent — ${deleted.error.message}`);
        }
    }

    const [sessionA, sessionB] = await Promise.all([
        signInTestUser(requireEnv('TEST_USER_A_EMAIL'), requireEnv('TEST_USER_A_PASSWORD')),
        signInTestUser(requireEnv('TEST_USER_B_EMAIL'), requireEnv('TEST_USER_B_PASSWORD')),
    ]);

    await releaseAuthUser(sessionA.authUserId);
    await releaseAuthUser(sessionB.authUserId);

    const parentA = await insertParent(sessionA.authUserId);
    const parentB = await insertParent(sessionB.authUserId);

    const studentA1 = await insertStudent({ parentId: parentA.parentId, withProgress: true });
    const studentA2 = await insertStudent({ parentId: parentA.parentId, withProgress: false });
    const studentB1 = await insertStudent({ parentId: parentB.parentId, withProgress: false });

    parentA.studentIds = [studentA1.studentId, studentA2.studentId];
    parentB.studentIds = [studentB1.studentId];

    return {
        app,
        deps,
        tokenA: sessionA.accessToken,
        tokenB: sessionB.accessToken,
        parentA,
        parentB,
        studentA1,
        studentA2,
        studentB1,
        llm,
        email,
        createParent: () => insertParent(null),
        createStudent: insertStudent,
        cleanup,
    };
}
