import { loadConfig, type AppConfig } from '../config/environment.js'

export interface ApiContainer {
    readonly config: AppConfig
}

export function createApiContainer(
    config: AppConfig = loadConfig(),
): ApiContainer {
    return { config }
}
