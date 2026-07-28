# Phase 1 — Scaffold & Shared Contracts

> **Wave 1 · single worker · blocks every other phase.**
> You are building the compiling skeleton of the DAS 7 backend and — most importantly — the **frozen contract files** that five parallel workers will implement against in Wave 2. Every interface you write here is load-bearing: later phases may **not** edit your files, so copy the signatures in this document exactly.

## What this service is (context)

A small Express API + background email scheduler for the DAS Parent Insight Dashboard: parents view their children's literacy progress, read AI-generated summaries, request recommendations, and receive periodic summary emails. TypeScript, Express 5, Supabase (Postgres + Auth), Jest. Full background: `docs/ARCHITECTURE.md` (optional reading; this file is self-sufficient).

## Files you own (create all of them)

```
backend/package.json            backend/tsconfig.json         backend/tsconfig.build.json
backend/jest.config.cjs         backend/.env.example          backend/.gitignore
backend/src/config.ts           backend/src/types.ts          backend/src/errors.ts
backend/src/deps.ts             backend/src/app.ts
backend/src/http/envelope.ts    backend/src/http/error-handler.ts
backend/src/http/auth.ts                          # partial placeholder, see below
backend/src/http/routes/health.routes.ts
backend/src/http/routes/me.routes.ts              # 501 stub
backend/src/http/routes/students.routes.ts        # 501 stub
backend/src/http/routes/preferences.routes.ts     # 501 stub
backend/src/adapters/llm/llm-client.ts            # interface only
backend/src/adapters/email/email-provider.ts      # interface only
backend/test/helpers/harness.ts                   # placeholder, see below
backend/test/unit/error-handler.test.ts
```

Do **not** create `src/index.ts`, any repo, service, or adapter *implementation* — those belong to other phases.

## Conventions (these apply to the whole project — you set the precedent)

- **ESM / NodeNext**: `"type": "module"` in package.json; every relative import ends in `.js` (e.g. `import { ApiError } from '../errors.js'`).
- 4-space indent, single quotes, semicolons.
- All HTTP responses use the envelope: `{ ok: true, data }` or `{ ok: false, error }` — only via the helpers in `envelope.ts`.
- Business code signals failure by **throwing** `ApiError` subclasses; the error middleware does the mapping. Never hand-write `res.status(...).json(...)` outside `envelope.ts`/`error-handler.ts`.
- IDs are generated with `crypto.randomUUID()` — no uuid dependency.

## Progress

Tick each box (`[ ]` → `[x]`) in this file as you complete the step. Do not change any other text in this document.

- [x] Step 1 — package.json
- [x] Step 2 — TypeScript & Jest config
- [x] Step 3 — `src/types.ts`
- [x] Step 4 — `src/errors.ts`
- [x] Step 5 — `src/config.ts`
- [x] Step 6 — `src/deps.ts`
- [x] Step 7 — adapter interface files
- [x] Step 8 — HTTP plumbing (envelope, error-handler, auth placeholder)
- [x] Step 9 — routes and app
- [x] Step 10 — `test/helpers/harness.ts` placeholder
- [x] Step 11 — `.env.example`
- [x] Step 12 — error-handler unit tests
- [x] Done criteria verified (typecheck + tests green, ownership respected)

## Step 1 — package.json

Scripts:

```json
{
  "dev": "tsx watch src/index.ts",
  "build": "tsc -p tsconfig.build.json",
  "start": "node dist/index.js",
  "typecheck": "tsc --noEmit",
  "test": "cross-env NODE_OPTIONS=--experimental-vm-modules jest",
  "seed": "tsx scripts/seed.ts"
}
```

Dependencies: `express@^5`, `@supabase/supabase-js@^2`, `jose` (latest), `dotenv`.
DevDependencies: `typescript@^5`, `jest@^30`, `ts-jest`, `@types/jest`, `@types/express@^5`, `@types/node`, `supertest`, `@types/supertest`, `cross-env`, `tsx`.

`dev`/`seed` reference files other phases create — that's fine; they must not be run in this phase.

**This file is frozen after Phase 1.** Later workers may not add dependencies; if one thinks a dependency is missing, they must report to the orchestrator instead.

## Step 2 — TypeScript & Jest config

`tsconfig.json` (typecheck everything, no emit):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "types": ["node", "jest"]
  },
  "include": ["src", "test", "scripts"]
}
```

`tsconfig.build.json`: extends `./tsconfig.json`, sets `"noEmit": false, "outDir": "dist", "rootDir": "src"`, includes only `["src"]`.

`jest.config.cjs`:

```js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
    transform: { '^.+\\.ts$': ['ts-jest', { useESM: true }] },
    setupFiles: ['dotenv/config'],
};
```

`.gitignore`: `node_modules/`, `dist/`, `.env`, `.env.*`, `!.env.example`, `CLAUDE.md`, `.claude/`. (`CLAUDE.md` is deliberately untracked — the orchestrator copies it into each worker checkout manually. If `backend/.gitignore` already contains these lines, leave it as is.)

## Step 3 — `src/types.ts` (domain types, verbatim)

These mirror the frontend's `src/types/domain.ts` and are part of the API contract. Copy exactly:

```ts
export type SkillArea =
    | 'Phonological Awareness' | 'Reading Accuracy' | 'Reading Fluency'
    | 'Spelling' | 'Writing' | 'Comprehension';

export const SKILL_AREAS: readonly SkillArea[] = [
    'Phonological Awareness', 'Reading Accuracy', 'Reading Fluency',
    'Spelling', 'Writing', 'Comprehension',
];

export interface Parent {
    parentId: string;
    name: string;
    email: string;
    mobileNumber: string;
    studentIds: string[];
}

export interface Student {
    studentId: string;
    name: string;
    dateOfBirth: string;   // bare 'YYYY-MM-DD'
    bandLevel: string;     // e.g. 'Band A'
}

export interface ProgressRecord {
    recordId: string;
    studentId: string;
    date: string;          // bare 'YYYY-MM-DD' — the chart depends on this format
    skillArea: SkillArea;
    score: number;         // 0..100
    notes: string;
}

export interface Summary {
    summaryId: string;
    studentId: string;
    content: string;
    generatedAt: string;   // full ISO 8601 datetime
}

export interface Recommendation {
    recommendationId: string;
    summaryId: string;     // keyed to a summary, not directly to the student
    content: string;       // '\n'-joined suggestion lines
    generatedAt: string;
}

export type NotificationFrequency = 'Weekly' | 'Fortnightly' | 'Monthly';

export const NOTIFICATION_FREQUENCIES: readonly NotificationFrequency[] =
    ['Weekly', 'Fortnightly', 'Monthly'];

export interface NotificationPreference {
    parentId: string;
    enabled: boolean;
    frequency: NotificationFrequency;
    recipientEmail: string;
}

// Express request augmentation: the auth middleware attaches the caller.
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            parent?: Parent;
        }
    }
}
export {};
```

## Step 4 — `src/errors.ts` (verbatim)

```ts
export class ApiError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
        this.name = new.target.name;
    }
}

export class UnauthorizedError extends ApiError {
    constructor() { super(401, 'unauthorised'); }
}

/** 404 — messages used: 'progressUnavailable', 'summaryUnavailable', 'notFound' */
export class NotFoundError extends ApiError {
    constructor(message = 'notFound') { super(404, message); }
}

/** 400 — message must be human-readable (the UI may display it) */
export class ValidationError extends ApiError {
    constructor(message: string) { super(400, message); }
}

/** 503 — messages used: 'progressUnavailable', 'summaryUnavailable', 'recommendationUnavailable' */
export class UnavailableError extends ApiError {
    constructor(message: string) { super(503, message); }
}
```

## Step 5 — `src/config.ts`

```ts
import type { NotificationFrequency } from './types.js';

export interface AppConfig {
    nodeEnv: 'development' | 'test' | 'production';
    port: number;
    supabaseUrl: string;
    supabaseServiceRoleKey: string;
    supabaseDbSchema: string;                    // default 'insight'
    supabaseJwksUrl: string;                     // default `${supabaseUrl}/auth/v1/.well-known/jwks.json`
    supabaseJwtSecret: string | null;            // legacy HS256 fallback (see Phase 3)
    authDevSub: string | null;                   // dev-only tokenless fallback
    llmProvider: 'stub' | 'anthropic' | 'openai' | 'gemini';
    llmApiKey: string | null;
    llmModel: string | null;
    llmTimeoutMs: number;                        // default 10000
    emailProvider: 'resend' | 'fake';
    resendApiKey: string | null;
    emailFrom: string | null;
    schedulerEnabled: boolean;                   // default false
    schedulerTickMs: number;                     // default 900000 (15 min)
    notifyIntervalsMs: Record<NotificationFrequency, number>;
        // defaults: Weekly 604800000, Fortnightly 1209600000, Monthly 2592000000
        // overridable via NOTIFY_WEEKLY_MS / NOTIFY_FORTNIGHTLY_MS / NOTIFY_MONTHLY_MS
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig
```

`loadConfig` parses `process.env` with the defaults above and **throws one Error listing every missing required variable** (required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Numbers are parsed with a fallback to defaults; booleans accept `'true'`. Unit tests never call `loadConfig` — they construct `AppConfig` literals — so keep it strict.

## Step 6 — `src/deps.ts` (the contract hub, verbatim)

This is the file the whole parallelization scheme hangs on. Later phases implement these interfaces; **nobody edits this file after Phase 1**.

```ts
import type { AppConfig } from './config.js';
import type {
    Parent, Student, ProgressRecord, Summary, Recommendation,
    NotificationPreference,
} from './types.js';
import type { LlmClient } from './adapters/llm/llm-client.js';
import type { EmailProvider } from './adapters/email/email-provider.js';

export interface ParentRepo {
    byAuthUserId(authUserId: string): Promise<Parent | null>;
    byId(parentId: string): Promise<Parent | null>;
}

export interface StudentRepo {
    byId(studentId: string): Promise<Student | null>;
    listByParent(parentId: string): Promise<Student[]>;
    isGuardian(parentId: string, studentId: string): Promise<boolean>;
}

export interface ProgressRepo {
    /** All records for the student, ordered by date ascending. */
    listByStudent(studentId: string): Promise<ProgressRecord[]>;
    /** ISO timestamp of the most recently INSERTED record (internal created_at), or null. */
    latestCreatedAt(studentId: string): Promise<string | null>;
}

export interface SummaryRepo {
    latestByStudent(studentId: string): Promise<Summary | null>;
    insert(input: { studentId: string; content: string }): Promise<Summary>;
}

export interface RecommendationRepo {
    insert(input: { summaryId: string; content: string }): Promise<Recommendation>;
}

export interface PreferenceRepo {
    byParentId(parentId: string): Promise<NotificationPreference | null>;
    upsert(pref: NotificationPreference): Promise<NotificationPreference>;
    listEnabled(): Promise<NotificationPreference[]>;
}

export interface EmailNotificationRepo {
    /** ISO sent_at of the newest notification for this parent, or null if none. */
    lastSentAt(parentId: string): Promise<string | null>;
    insert(input: {
        parentId: string;
        summaryId: string | null;
        recipientEmail: string;
        subject: string;
        body: string;
    }): Promise<void>;
}

export interface InsightService {
    trackProgress(studentId: string): Promise<{ progress: ProgressRecord[]; summary: Summary }>;
    getSummary(studentId: string): Promise<Summary>;
    createRecommendation(studentId: string): Promise<Recommendation>;
}

export interface PreferenceService {
    get(parentId: string): Promise<NotificationPreference>;
    /** Validates the raw request body; throws ValidationError with a human-readable message. */
    save(parentId: string, body: unknown): Promise<NotificationPreference>;
}

export type NotifyOutcome = 'parentNotified' | 'notificationFailed';

export interface NotifierService {
    notifyParent(parentId: string, now: Date): Promise<NotifyOutcome>;
    runDueNotifications(now: Date): Promise<Array<{ parentId: string; outcome: NotifyOutcome }>>;
}

export interface Deps {
    config: AppConfig;
    parentRepo: ParentRepo;
    studentRepo: StudentRepo;
    progressRepo: ProgressRepo;
    summaryRepo: SummaryRepo;
    recommendationRepo: RecommendationRepo;
    preferenceRepo: PreferenceRepo;
    emailNotificationRepo: EmailNotificationRepo;
    llm: LlmClient;
    email: EmailProvider;
    insightService: InsightService;
    preferenceService: PreferenceService;
    notifierService: NotifierService;
}
```

## Step 7 — adapter interface files (interface only, no implementations)

`src/adapters/llm/llm-client.ts`:

```ts
import type { Student, ProgressRecord, Summary } from '../../types.js';

/** Thrown for ANY llm failure mode: unreachable, timeout, malformed output. */
export class LlmUnavailableError extends Error {
    constructor(message = 'llm unavailable') { super(message); this.name = 'LlmUnavailableError'; }
}

export interface LlmClient {
    generateSummary(input: { student: Student; records: ProgressRecord[] }): Promise<string>;
    /** Returns '\n'-joined suggestion lines. */
    generateRecommendation(input: { student: Student; summary: Summary }): Promise<string>;
}
```

`src/adapters/email/email-provider.ts`:

```ts
export interface SentEmail {
    to: string;
    subject: string;
    body: string;
}

export class EmailSendError extends Error {
    constructor(message = 'email send failed') { super(message); this.name = 'EmailSendError'; }
}

export interface EmailProvider {
    /** Resolves on success; throws EmailSendError on any failure. */
    send(email: SentEmail): Promise<void>;
}
```

## Step 8 — HTTP plumbing

`src/http/envelope.ts`:

```ts
import type { Response } from 'express';

export function ok<T>(res: Response, data: T, status = 200): void {
    res.status(status).json({ ok: true, data });
}

export function fail(res: Response, status: number, error: string): void {
    res.status(status).json({ ok: false, error });
}
```

`src/http/error-handler.ts` — two exports:

- `notFoundHandler` — terminal middleware: `fail(res, 404, 'notFound')`.
- `errorHandler` — Express error middleware `(err, req, res, next)`: if `err instanceof ApiError` → `fail(res, err.status, err.message)`; otherwise `console.error(err)` then `fail(res, 500, 'internalError')`. (Express 5 routes rejected async handlers here automatically.)

`src/http/auth.ts` — **partial placeholder**. The two authorization helpers are final; the authentication middleware is a stub that Phase 3 will rewrite **keeping the exact same export signature**:

```ts
import type { RequestHandler } from 'express';
import type { AppConfig } from '../config.js';
import type { ParentRepo, StudentRepo } from '../deps.js';
import type { Parent } from '../types.js';
import { NotFoundError, UnauthorizedError } from '../errors.js';

/**
 * Authentication middleware factory. PHASE 1 PLACEHOLDER:
 * only supports the AUTH_DEV_SUB dev fallback; Phase 3 adds real JWT verification.
 */
export function createAuthenticate(
    deps: { parentRepo: ParentRepo; config: AppConfig },
): RequestHandler {
    return async (req, _res, next) => {
        const { config, parentRepo } = deps;
        if (!req.headers.authorization && config.authDevSub && config.nodeEnv !== 'production') {
            const parent = await parentRepo.byAuthUserId(config.authDevSub);
            if (!parent) throw new UnauthorizedError();
            req.parent = parent;
            return next();
        }
        throw new UnauthorizedError(); // Phase 3 replaces this branch with JWT verification
    };
}

/** FINAL. Unowned and nonexistent students are deliberately indistinguishable (both 404). */
export async function requireOwnStudent(
    studentRepo: StudentRepo, parent: Parent, studentId: string,
): Promise<void> {
    if (!(await studentRepo.isGuardian(parent.parentId, studentId))) {
        throw new NotFoundError('progressUnavailable');
    }
}

/** FINAL. A foreign parentId is indistinguishable from a nonexistent one (404). */
export function requireOwnParent(parent: Parent, parentId: string): void {
    if (parent.parentId !== parentId) throw new NotFoundError();
}
```

## Step 9 — routes and app

`src/http/routes/health.routes.ts` — real: `GET /` → `ok(res, { ok: true })` (mounted at `/api/health`).

`me.routes.ts`, `students.routes.ts`, `preferences.routes.ts` — stubs with the **final factory signatures**, each route present and throwing `new ApiError(501, 'notImplemented')`:

- `export function meRoutes(deps: Deps): Router` — `GET /`
- `export function studentsRoutes(deps: Deps): Router` — `GET /:studentId/track-progress`, `GET /:studentId/summary`, `POST /:studentId/recommendations`
- `export function preferencesRoutes(deps: Deps): Router` — `GET /:parentId/preferences`, `PUT /:parentId/preferences`

`src/app.ts` — **final**:

```ts
export function createApp(deps: Deps): express.Express
```

Order: `express.json()` → mount `/api/health` (NO auth) → `createAuthenticate(deps)` for everything below → `/api/me` → `/api/students` → `/api/parents` → `notFoundHandler` → `errorHandler`.

## Step 10 — `test/helpers/harness.ts` (placeholder with frozen API)

Wave 2 workers write integration tests against this API; Phase 7 implements it. The tests must compile now and self-skip until then.

```ts
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
```

## Step 11 — `.env.example`

List every variable with comments and safe defaults: `NODE_ENV`, `PORT=4000`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only secret, never commit), `SUPABASE_DB_SCHEMA=insight`, `SUPABASE_JWKS_URL` (blank = derived), `SUPABASE_JWT_SECRET` (blank unless project uses legacy HS256 tokens), `AUTH_DEV_SUB`, `LLM_PROVIDER=stub`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_TIMEOUT_MS=10000`, `EMAIL_PROVIDER=fake`, `RESEND_API_KEY`, `EMAIL_FROM`, `SCHEDULER_ENABLED=false`, `SCHEDULER_TICK_MS=900000`, `NOTIFY_WEEKLY_MS`, `NOTIFY_FORTNIGHTLY_MS`, `NOTIFY_MONTHLY_MS`, and the test-only block: `SUPABASE_ANON_KEY`, `TEST_SUPABASE_REF`, `TEST_USER_A_EMAIL`, `TEST_USER_A_PASSWORD`, `TEST_USER_B_EMAIL`, `TEST_USER_B_PASSWORD`.

## Step 12 — `test/unit/error-handler.test.ts`

Using supertest against a tiny throwaway Express app wired with your `errorHandler`/`notFoundHandler`:

1. Each `ApiError` subclass maps to its status + `{ ok: false, error: message }`.
2. A generic `Error` maps to 500 `{ ok: false, error: 'internalError' }` (and does not leak the message).
3. An unknown route returns 404 `{ ok: false, error: 'notFound' }`.
4. A rejected async handler reaches the error middleware (Express 5 behavior).

## Done criteria

- `npm install` succeeds; `npm run typecheck` clean; `npm test` green (error-handler suite passes; no other suites exist yet).
- `GET /api/health` returns `{ ok: true, data: { ok: true } }` when the app is built with dummy deps (you may verify with supertest inside the error-handler test file rather than starting a server).
- No file outside the ownership list was created or modified.
