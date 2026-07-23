import type { Server } from 'node:http'
import { createProductionApiContainer } from '../app/api-container.js'
import { createApiApp } from '../app/create-api-app.js'

const container = createProductionApiContainer()
const app = createApiApp(container)
const server = app.listen(container.config.api.port, () => {
    const port = container.config.api.port
    console.log(`[server] DAS 7 backend listening on http://localhost:${port}`)
    console.log(`[server] health: http://localhost:${port}/api/health`)
})

installShutdownHandlers(server, container.close)

function installShutdownHandlers(
    httpServer: Server,
    closeContainer: () => Promise<void>,
): void {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        process.once(signal, () => {
            console.log(`[server] received ${signal}; shutting down`)

            httpServer.close(async (error) => {
                if (error) {
                    console.error('[server] shutdown failed:', error)
                    process.exitCode = 1
                }

                try {
                    await closeContainer()
                } catch (closeError) {
                    console.error('[server] resource shutdown failed:', closeError)
                    process.exitCode = 1
                }
            })
        })
    }
}
