import { describe, expect, it } from '@jest/globals'
import {
    ConfigurationError,
    loadConfig,
} from '../../../src/config/environment.js'

describe('loadConfig', () => {
    it('uses safe development defaults', () => {
        const config = loadConfig({ NODE_ENV: 'development' })

        expect(config.api).toEqual({
            port: 4000,
        })
        expect(config.mysql).toMatchObject({
            host: 'localhost',
            port: 3306,
            database: 'das7',
            user: 'das7',
        })
        expect(config.supabase).toMatchObject({
            schema: 'insight',
        })
        expect(config.worker).toEqual({
            enabled: false,
            pollIntervalMs: 60_000,
            timezone: 'Asia/Singapore',
        })
        expect(config.llm).toEqual({
            provider: undefined,
            apiBaseUrl: undefined,
            apiKey: undefined,
            model: undefined,
            timeoutMs: 10_000,
        })
    })

    it('loads a complete production configuration', () => {
        const config = loadConfig({
            NODE_ENV: 'production',
            PORT: '4100',
            MYSQL_HOST: 'mysql.example.com',
            MYSQL_PORT: '3307',
            MYSQL_DATABASE: 'das7',
            MYSQL_USER: 'das7_app',
            MYSQL_PASSWORD: 'production-password',
            LLM_PROVIDER: 'example-provider',
            LLM_API_BASE_URL: 'https://llm.example.com/v1/complete',
            LLM_API_KEY: 'production-llm-key',
            LLM_MODEL: 'example-model-1',
            LLM_TIMEOUT_MS: '20000',
            EMAIL_PROVIDER_URL: 'https://email.example.com',
            WORKER_ENABLED: 'true',
            WORKER_POLL_INTERVAL_MS: '30000',
            NOTIFICATION_TIMEZONE: 'Asia/Singapore',
        })

        expect(config).toMatchObject({
            environment: 'production',
            api: { port: 4100 },
            mysql: { host: 'mysql.example.com', port: 3307 },
            llm: {
                provider: 'example-provider',
                apiBaseUrl: 'https://llm.example.com/v1/complete',
                apiKey: 'production-llm-key',
                model: 'example-model-1',
                timeoutMs: 20_000,
            },
            email: { providerUrl: 'https://email.example.com' },
            worker: {
                enabled: true,
                pollIntervalMs: 30_000,
                timezone: 'Asia/Singapore',
            },
        })
    })

    it('reports missing production values together', () => {
        const configurationError = captureConfigurationError(() =>
            loadConfig({ NODE_ENV: 'production' }),
        )

        expect(configurationError.issues).toEqual(
            expect.arrayContaining([
                'MYSQL_HOST is required when NODE_ENV=production',
                'MYSQL_PASSWORD is required when NODE_ENV=production',
                'LLM_PROVIDER is required when NODE_ENV=production',
                'LLM_API_BASE_URL is required when NODE_ENV=production',
                'LLM_API_KEY is required when NODE_ENV=production',
                'LLM_MODEL is required when NODE_ENV=production',
                'EMAIL_PROVIDER_URL is required when NODE_ENV=production',
            ]),
        )
    })

    it('rejects malformed values', () => {
        const configurationError = captureConfigurationError(() =>
            loadConfig({
                NODE_ENV: 'development',
                PORT: 'not-a-port',
                MYSQL_PORT: '70000',
                WORKER_ENABLED: 'sometimes',
                LLM_TIMEOUT_MS: 'not-a-timeout',
                NOTIFICATION_TIMEZONE: 'Not/ATimezone',
            }),
        )
        const issues = configurationError.issues.join('\n')

        expect(issues).toEqual(expect.stringContaining('PORT'))
        expect(issues).toEqual(expect.stringContaining('WORKER_ENABLED'))
        expect(issues).toEqual(expect.stringContaining('LLM_TIMEOUT_MS'))
        expect(issues).toEqual(
            expect.stringContaining('NOTIFICATION_TIMEZONE'),
        )
    })

    it('rejects an LLM API base URL that does not use http or https', () => {
        const configurationError = captureConfigurationError(() =>
            loadConfig({
                NODE_ENV: 'development',
                LLM_API_BASE_URL: 'ftp://llm.example.com',
            }),
        )

        expect(configurationError.issues.join('\n')).toEqual(
            expect.stringContaining('LLM_API_BASE_URL'),
        )
    })
})

function captureConfigurationError(
    action: () => unknown,
): ConfigurationError {
    try {
        action()
    } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError)
        return error as ConfigurationError
    }

    throw new Error('Expected configuration validation to fail')
}
