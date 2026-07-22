import { createWorkerContainer } from '../app/worker-container.js'

const container = createWorkerContainer()

if (container.config.worker.enabled) {
    console.log(
        `[worker] DAS 7 worker enabled; polling every ${container.config.worker.pollIntervalMs}ms`,
    )
} else {
    console.log('[worker] DAS 7 worker is disabled by configuration')
}
