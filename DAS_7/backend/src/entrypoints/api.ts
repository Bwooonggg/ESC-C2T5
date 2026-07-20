import type { Server } from 'node:http'
import { createApiApp } from '../app/create-api-app.js'

const port = readPort(process.env.PORT)
const app = createApiApp()
const server = app.listen(port, () => {
    console.log(`[server] DAS 7 backend listening on http://localhost:${port}`)
    console.log(`[server] health: http://localhost:${port}/api/health`)
})

installShutdownHandlers(server)

function readPort(value: string | undefined): number {
    const port = Number(value ?? 4000)

    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error('PORT must be an integer between 1 and 65535.')
    }

    return port
}

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
