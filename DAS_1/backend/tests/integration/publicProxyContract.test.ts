// @vitest-environment node
import { rm } from 'node:fs/promises'
import { createServer as createHttpServer, type Server } from 'node:http'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer as createViteServer, type ViteDevServer } from 'vite'
import { createApp } from '../../app.ts'
import { dataFile } from '../../config.ts'

let backendServer: Server
let viteServer: ViteDevServer
let proxyBaseUrl: string

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
}

beforeAll(async () => {
  backendServer = createHttpServer(createApp())
  await new Promise<void>((resolve, reject) => {
    backendServer.once('error', reject)
    backendServer.listen(4173, () => {
      backendServer.off('error', reject)
      resolve()
    })
  })

  viteServer = await createViteServer({
    configFile: path.resolve(process.cwd(), '../../frontend/vite.config.ts'),
    logLevel: 'error',
    server: { port: 0, strictPort: true },
  })
  await viteServer.listen()

  const url = viteServer.resolvedUrls?.local?.[0]
  if (!url) {
    throw new Error('Root Vite server did not expose a local URL.')
  }
  proxyBaseUrl = url.replace(/\/$/, '')
})

afterAll(async () => {
  await viteServer?.close()
  if (backendServer?.listening) {
    await close(backendServer)
  }
  await rm(dataFile, { force: true })
})

describe('root Vite public screening proxy', () => {
  it('strips /api/screening and reaches the public backend without a login', async () => {
    const response = await fetch(`${proxyBaseUrl}/api/screening/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ screenerType: 'adult' }),
    })

    expect(response.status).toBe(201)
    const session = (await response.json()) as { screenerType: string; stage: string }
    expect(session).toMatchObject({ screenerType: 'adult', stage: 'screening' })
  })
})
