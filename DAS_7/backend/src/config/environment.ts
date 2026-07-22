import { config as loadDotEnv } from 'dotenv'
import { z } from 'zod'

loadDotEnv({ quiet: true })

export type RuntimeEnvironment = 'development' | 'test' | 'production'

export interface AppConfig {
    readonly environment: RuntimeEnvironment
    readonly api: {
        readonly port: number
    }
    readonly mysql: {
        readonly host: string
        readonly port: number
        readonly database: string
        readonly user: string
        readonly password: string
    }
    readonly generators: {
        readonly summaryUrl?: string
        readonly recommendationUrl?: string
        readonly summaryApiKey?: string
        readonly recommendationApiKey?: string
    }
    readonly email: {
        readonly providerUrl?: string
        readonly providerApiKey?: string
    }
    readonly worker: {
        readonly enabled: boolean
        readonly pollIntervalMs: number
        readonly timezone: string
    }
}

export class ConfigurationError extends Error {
    readonly issues: readonly string[]

    constructor(issues: readonly string[]) {
        super(
            `Invalid environment configuration:\n${issues
                .map((issue) => `- ${issue}`)
                .join('\n')}`,
        )
        this.name = 'ConfigurationError'
        this.issues = issues
    }
}

// Reusable validation schemes
const httpUrlSchema = z
    .string()
    .url()
    .refine(
        (value) => ['http:', 'https:'].includes(new URL(value).protocol),
        'must use http or https',
    )

const optionalStringSchema = z.preprocess(
    (value) => {
        if (typeof value !== 'string') {
            return value
        }

        const trimmed = value.trim()
        return trimmed === '' ? undefined : trimmed
    },
    z.string().optional(),
)

const optionalUrlSchema = z.preprocess(
    (value) => {
        if (typeof value === 'string' && value.trim() === '') {
            return undefined
        }

        return value
    },
    httpUrlSchema.optional(),
)

const booleanSchema = z.preprocess(
    (value) => {
        if (value === undefined || typeof value === 'boolean') {
            return value
        }

        if (value === 'true') {
            return true
        }

        if (value === 'false') {
            return false
        }

        return value
    },
    z.boolean().default(false),
)

const timezoneSchema = z.string().refine(
    (value) => {
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
            return true
        } catch {
            return false
        }
    },
    'must be a valid IANA timezone',
)

const rawEnvironmentSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'test', 'production'])
        .default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    MYSQL_HOST: z.string().trim().min(1).default('localhost'),
    MYSQL_PORT: z.coerce.number().int().min(1).max(65_535).default(3306),
    MYSQL_DATABASE: z.string().trim().min(1).default('das7'),
    MYSQL_USER: z.string().trim().min(1).default('das7'),
    MYSQL_PASSWORD: z.string().default('change-me'),
    SUMMARY_GENERATOR_URL: optionalUrlSchema,
    RECOMMENDATION_GENERATOR_URL: optionalUrlSchema,
    SUMMARY_GENERATOR_API_KEY: optionalStringSchema,
    RECOMMENDATION_GENERATOR_API_KEY: optionalStringSchema,
    EMAIL_PROVIDER_URL: optionalUrlSchema,
    EMAIL_PROVIDER_API_KEY: optionalStringSchema,
    WORKER_ENABLED: booleanSchema,
    WORKER_POLL_INTERVAL_MS: z.coerce
        .number()
        .int()
        .min(1_000)
        .max(86_400_000)
        .default(60_000),
    NOTIFICATION_TIMEZONE: timezoneSchema.default('Asia/Singapore'),
})

type RawEnvironment = z.infer<typeof rawEnvironmentSchema>

export function loadConfig(
    environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
    const parsed = rawEnvironmentSchema.safeParse(environment)

    if (!parsed.success) {
        throw new ConfigurationError(
            parsed.error.issues.map((issue) => {
                const path = issue.path.join('.') || 'environment'
                return `${path}: ${issue.message}`
            }),
        )
    }

    const raw = parsed.data
    const productionIssues = getProductionIssues(environment, raw)

    if (productionIssues.length > 0) {
        throw new ConfigurationError(productionIssues)
    }

    return toAppConfig(raw)
}

function getProductionIssues(
    environment: NodeJS.ProcessEnv,
    raw: RawEnvironment,
): string[] {
    if (raw.NODE_ENV !== 'production') {
        return []
    }

    const required = [
        'MYSQL_HOST',
        'MYSQL_DATABASE',
        'MYSQL_USER',
        'MYSQL_PASSWORD',
        'SUMMARY_GENERATOR_URL',
        'RECOMMENDATION_GENERATOR_URL',
        'EMAIL_PROVIDER_URL',
    ] as const

    const issues = required
        .filter((key) => !hasValue(environment[key]))
        .map((key) => `${key} is required when NODE_ENV=production`)

    return issues
}

function hasValue(value: string | undefined): boolean {
    return value !== undefined && value.trim() !== ''
}

// Convert raw values to app configuration
function toAppConfig(raw: RawEnvironment): AppConfig {
    return {
        environment: raw.NODE_ENV,
        api: {
            port: raw.PORT,
        },
        mysql: {
            host: raw.MYSQL_HOST,
            port: raw.MYSQL_PORT,
            database: raw.MYSQL_DATABASE,
            user: raw.MYSQL_USER,
            password: raw.MYSQL_PASSWORD,
        },
        generators: {
            summaryUrl: raw.SUMMARY_GENERATOR_URL,
            recommendationUrl: raw.RECOMMENDATION_GENERATOR_URL,
            summaryApiKey: raw.SUMMARY_GENERATOR_API_KEY,
            recommendationApiKey: raw.RECOMMENDATION_GENERATOR_API_KEY,
        },
        email: {
            providerUrl: raw.EMAIL_PROVIDER_URL,
            providerApiKey: raw.EMAIL_PROVIDER_API_KEY,
        },
        worker: {
            enabled: raw.WORKER_ENABLED,
            pollIntervalMs: raw.WORKER_POLL_INTERVAL_MS,
            timezone: raw.NOTIFICATION_TIMEZONE,
        },
    }
}
