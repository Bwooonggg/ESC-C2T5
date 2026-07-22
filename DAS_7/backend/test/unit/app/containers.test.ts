import { describe, expect, it } from '@jest/globals'
import { createApiContainer } from '../../../src/app/api-container.js'
import { createWorkerContainer } from '../../../src/app/worker-container.js'
import { loadConfig } from '../../../src/config/environment.js'

describe('application containers', () => {
    it('creates separate API and worker containers from shared configuration', () => {
        const config = loadConfig({ NODE_ENV: 'test' })
        const apiContainer = createApiContainer(config)
        const workerContainer = createWorkerContainer(config)

        expect(apiContainer).not.toBe(workerContainer)
        expect(apiContainer.config).toBe(config)
        expect(workerContainer.config).toBe(config)
    })
})
