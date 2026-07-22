import type { Server } from 'node:http'
import { createApiContainer } from '../app/api-container.js'
import { createApiApp } from '../app/create-api-app.js'

const container = createApiContainer()
const app = createApiApp(container)
const server = app.listen(container.config.api.port, () => {
    const port = container.config.api.port
    console.log(`[server] DAS 7 backend listening on http://localhost:${port}`)
    console.log(`[server] health: http://localhost:${port}/api/health`)
})

installShutdownHandlers(server)

function installShutdownHandlers(httpServer: Server): void {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        process.once(signal, () => {
            console.log(`[server] received ${signal}; shutting down`)

            httpServer.close((error) => {
                if (error) {
                    console.error('[server] shutdown failed:', error)
                    process.exitCode = 1
                }
            })
        })
    }
}
