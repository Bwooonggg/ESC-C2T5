import { loadConfig, type AppConfig } from '../config/environment.js'
import { createMySqlPool } from '../infrastructure/mysql/pool.js'
import {
    MySqlProgressRecordRepository,
    MySqlStudentRepository,
    MySqlSummaryRepository,
} from '../infrastructure/mysql/repositories/index.js'
import {
    GeneratorHttpClient,
    GeneratorServiceError,
    SummaryGeneratorAdapter,
} from '../adapters/generators/index.js'
import type { SummaryGeneratorPort } from '../modules/track-progress/ports/summary-generator.js'
import {
    createGeneratorInvocationContext,
    type GeneratorInvocationContext,
} from '../shared/generator-context.js'
import { TrackProgressModel } from '../modules/track-progress/application/track-progress.model.js'
import type { SummaryGeneratorClientRequest } from '../adapters/generators/summary-generator.client.js'

export interface ApiContainer {
    readonly config: AppConfig
    readonly trackProgressModel?: TrackProgressModel
    readonly close: () => Promise<void>
}

export interface ApiContainerOptions {
    readonly trackProgressModel?: TrackProgressModel
    readonly close?: () => Promise<void>
}

export function createApiContainer(
    config: AppConfig = loadConfig(),
    options: ApiContainerOptions = {},
): ApiContainer {
    return {
        config,
        trackProgressModel: options.trackProgressModel,
        close: options.close ?? (async () => undefined),
    }
}

export function createProductionApiContainer(
    config: AppConfig = loadConfig(),
): ApiContainer {
    const pool = createMySqlPool(config.mysql)
    const summaryGenerator = createSummaryGenerator(config)
    const trackProgressModel = new TrackProgressModel({
        studentRepository: new MySqlStudentRepository(pool),
        progressRecordRepository: new MySqlProgressRecordRepository(pool),
        summaryRepository: new MySqlSummaryRepository(pool),
        summaryGenerator,
    })

    return {
        config,
        trackProgressModel,
        close: () => pool.end(),
    }
}

function createSummaryGenerator(config: AppConfig): SummaryGeneratorPort {
    const endpoint = config.generators.summaryUrl

    if (!endpoint) {
        return new UnconfiguredSummaryGenerator()
    }

    const client = new GeneratorHttpClient<SummaryGeneratorClientRequest>({
        endpoint,
        serviceName: 'SummaryGeneratorService',
        timeoutMs: config.generators.summaryTimeoutMs,
        headers: config.generators.summaryApiKey
            ? { authorization: `Bearer ${config.generators.summaryApiKey}` }
            : undefined,
    })

    return new SummaryGeneratorAdapter(client)
}

class UnconfiguredSummaryGenerator implements SummaryGeneratorPort {
    async generate(
        _request: Parameters<SummaryGeneratorPort['generate']>[0],
        context?: GeneratorInvocationContext,
    ): ReturnType<SummaryGeneratorPort['generate']> {
        const invocationContext =
            context ?? createGeneratorInvocationContext()

        throw new GeneratorServiceError({
            code: 'UNAVAILABLE',
            serviceName: 'SummaryGeneratorService',
            correlationId: invocationContext.correlationId,
            message: 'Summary generator is not configured.',
            retryable: false,
        })
    }
}
