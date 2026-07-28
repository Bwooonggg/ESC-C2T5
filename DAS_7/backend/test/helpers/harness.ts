import type { Express } from 'express';
import type { Deps } from '../../src/deps.js';
import type { Parent, Student } from '../../src/types.js';
import type { SentEmail } from '../../src/adapters/email/email-provider.js';

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

export async function createHarness(): Promise<TestHarness> {
    throw new Error('createHarness is implemented in Phase 7');
}
