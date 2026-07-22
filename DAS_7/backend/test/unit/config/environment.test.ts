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
        expect(config.worker).toEqual({
            enabled: false,
            pollIntervalMs: 60_000,
            timezone: 'Asia/Singapore',
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
            SUMMARY_GENERATOR_URL: 'https://summary.example.com',
            RECOMMENDATION_GENERATOR_URL:
                'https://recommendation.example.com',
            EMAIL_PROVIDER_URL: 'https://email.example.com',
            WORKER_ENABLED: 'true',
            WORKER_POLL_INTERVAL_MS: '30000',
            NOTIFICATION_TIMEZONE: 'Asia/Singapore',
        })

        expect(config).toMatchObject({
            environment: 'production',
            api: { port: 4100 },
            mysql: { host: 'mysql.example.com', port: 3307 },
            generators: {
                summaryUrl: 'https://summary.example.com',
                recommendationUrl: 'https://recommendation.example.com',
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
                'SUMMARY_GENERATOR_URL is required when NODE_ENV=production',
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
                NOTIFICATION_TIMEZONE: 'Not/ATimezone',
            }),
        )

        expect(configurationError.issues.join('\n')).toEqual(
            expect.stringContaining('PORT'),
        )
        expect(configurationError.issues.join('\n')).toEqual(
            expect.stringContaining('WORKER_ENABLED'),
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
