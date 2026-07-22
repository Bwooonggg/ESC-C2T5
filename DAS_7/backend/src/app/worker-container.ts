import { loadConfig, type AppConfig } from '../config/environment.js'

export interface WorkerContainer {
    readonly config: AppConfig
}

export function createWorkerContainer(
    config: AppConfig = loadConfig(),
): WorkerContainer {
    return { config }
}
