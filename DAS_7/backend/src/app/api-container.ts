import { loadConfig, type AppConfig } from '../config/environment.js'
import { createMySqlPool } from '../infrastructure/mysql/pool.js'
import {
    MySqlProgressRecordRepository,
    MySqlRecommendationRepository,
    MySqlStudentRepository,
    MySqlSummaryRepository,
} from '../infrastructure/mysql/repositories/index.js'
import {
    createLlmClient,
    RecommendationGeneratorAdapter,
    SummaryGeneratorAdapter,
} from '../infrastructure/llm/index.js'
import { GenerateStudentSummary } from '../modules/summaries/application/generate-student-summary.js'
import { TrackProgressModel } from '../modules/track-progress/application/track-progress.model.js'
import { RecommendationModel } from '../modules/track-progress/application/recommendation.model.js'
import { GetPreferencesModel } from '../modules/preferences/application/get-preferences.js'
import { SavePreferencesModel } from '../modules/preferences/application/save-preferences.js'
import { MySqlNotificationPreferenceRepository } from '../infrastructure/mysql/repositories/mysql-notification-preference.repository.js'
import type { ReadinessProbe } from '../shared/readiness.js'

export interface ApiContainer {
    readonly config: AppConfig
    readonly trackProgressModel?: TrackProgressModel
    readonly recommendationModel?: RecommendationModel
    readonly getPreferencesModel?: GetPreferencesModel
    readonly savePreferencesModel?: SavePreferencesModel
    /** Optional platform-backed readiness check; no secret client is created here. */
    readonly readiness?: ReadinessProbe
    readonly close: () => Promise<void>
}

export interface ApiContainerOptions {
    readonly trackProgressModel?: TrackProgressModel
    readonly recommendationModel?: RecommendationModel
    readonly getPreferencesModel?: GetPreferencesModel
    readonly savePreferencesModel?: SavePreferencesModel
    readonly readiness?: ReadinessProbe
    readonly close?: () => Promise<void>
}

export function createApiContainer(
    config: AppConfig = loadConfig(),
    options: ApiContainerOptions = {},
): ApiContainer {
    return {
        config,
        trackProgressModel: options.trackProgressModel,
        recommendationModel: options.recommendationModel,
        getPreferencesModel: options.getPreferencesModel,
        savePreferencesModel: options.savePreferencesModel,
        readiness: options.readiness,
        close: options.close ?? (async () => undefined),
    }
}

export function createProductionApiContainer(
    config: AppConfig = loadConfig(),
): ApiContainer {
    const pool = createMySqlPool(config.mysql)
    const llmClient = createLlmClient(config.llm)
    const summaryRepository = new MySqlSummaryRepository(pool)
    const notificationPreferenceRepository =
        new MySqlNotificationPreferenceRepository(pool)
    // The request path builds the shared capability from request-scoped
    // repositories. The worker builds the same capability from its own graph.
    const generateStudentSummary = new GenerateStudentSummary({
        studentRepository: new MySqlStudentRepository(pool),
        progressRecordRepository: new MySqlProgressRecordRepository(pool),
        summaryRepository,
        summaryGenerator: new SummaryGeneratorAdapter(llmClient),
    })
    const trackProgressModel = new TrackProgressModel({
        generateStudentSummary,
    })
    const recommendationModel = new RecommendationModel({
        summaryRepository,
        recommendationRepository: new MySqlRecommendationRepository(pool),
        recommendationGenerator: new RecommendationGeneratorAdapter(llmClient),
    })
    const getPreferencesModel = new GetPreferencesModel({
        notificationPreferenceRepository,
    })
    const savePreferencesModel = new SavePreferencesModel({
        notificationPreferenceRepository,
    })

    return {
        config,
        trackProgressModel,
        recommendationModel,
        getPreferencesModel,
        savePreferencesModel,
        close: () => pool.end(),
    }
}
