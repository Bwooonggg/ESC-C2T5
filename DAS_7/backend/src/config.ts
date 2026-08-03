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

const NODE_ENVS = ['development', 'test', 'production'] as const;
const LLM_PROVIDERS = ['stub', 'anthropic', 'openai', 'gemini'] as const;
const EMAIL_PROVIDERS = ['resend', 'fake'] as const;

const DEFAULT_NOTIFY_INTERVALS_MS: Record<NotificationFrequency, number> = {
    Weekly: 604800000,
    Fortnightly: 1209600000,
    Monthly: 2592000000,
};

/** Trimmed value, or null when unset/blank. */
function optional(env: NodeJS.ProcessEnv, key: string): string | null {
    const raw = env[key];
    if (raw === undefined) return null;
    const trimmed = raw.trim();
    return trimmed === '' ? null : trimmed;
}

function oneOf<T extends string>(
    env: NodeJS.ProcessEnv, key: string, allowed: readonly T[], fallback: T,
): T {
    const value = optional(env, key);
    return value !== null && (allowed as readonly string[]).includes(value)
        ? value as T
        : fallback;
}

/** Finite, non-negative numbers only; anything else falls back to the default. */
function num(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
    const value = optional(env, key);
    if (value === null) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function bool(env: NodeJS.ProcessEnv, key: string, fallback: boolean): boolean {
    const value = optional(env, key);
    if (value === null) return fallback;
    return value.toLowerCase() === 'true';
}

/**
 * Reads configuration from the environment.
 * Throws a single Error listing every missing required variable.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
    const supabaseUrl = optional(env, 'SUPABASE_URL');
    const supabaseServiceRoleKey = optional(env, 'SUPABASE_SERVICE_ROLE_KEY');

    const missing: string[] = [];
    if (supabaseUrl === null) missing.push('SUPABASE_URL');
    if (supabaseServiceRoleKey === null) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    const url = supabaseUrl as string;

    return {
        nodeEnv: oneOf(env, 'NODE_ENV', NODE_ENVS, 'development'),
        port: num(env, 'PORT', 4000),
        supabaseUrl: url,
        supabaseServiceRoleKey: supabaseServiceRoleKey as string,
        supabaseDbSchema: optional(env, 'SUPABASE_DB_SCHEMA') ?? 'insight',
        supabaseJwksUrl:
            optional(env, 'SUPABASE_JWKS_URL')
            ?? `${url.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`,
        supabaseJwtSecret: optional(env, 'SUPABASE_JWT_SECRET'),
        authDevSub: optional(env, 'AUTH_DEV_SUB'),
        llmProvider: oneOf(env, 'LLM_PROVIDER', LLM_PROVIDERS, 'stub'),
        llmApiKey: optional(env, 'LLM_API_KEY'),
        llmModel: optional(env, 'LLM_MODEL'),
        llmTimeoutMs: num(env, 'LLM_TIMEOUT_MS', 10000),
        emailProvider: oneOf(env, 'EMAIL_PROVIDER', EMAIL_PROVIDERS, 'fake'),
        resendApiKey: optional(env, 'RESEND_API_KEY'),
        emailFrom: optional(env, 'EMAIL_FROM'),
        schedulerEnabled: bool(env, 'SCHEDULER_ENABLED', false),
        schedulerTickMs: num(env, 'SCHEDULER_TICK_MS', 900000),
        notifyIntervalsMs: {
            Weekly: num(env, 'NOTIFY_WEEKLY_MS', DEFAULT_NOTIFY_INTERVALS_MS.Weekly),
            Fortnightly: num(env, 'NOTIFY_FORTNIGHTLY_MS', DEFAULT_NOTIFY_INTERVALS_MS.Fortnightly),
            Monthly: num(env, 'NOTIFY_MONTHLY_MS', DEFAULT_NOTIFY_INTERVALS_MS.Monthly),
        },
    };
}
