import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.ts'

/**
 * IT-13 — the smallest end-to-end slice: app.ts mounts screenerRoutes.ts at the
 * root and express.json() sits in front of it. The gateway owns /api/screening
 * and strips it before forwarding, so the backend itself answers on bare paths.
 * If the mount prefix or the router export ever breaks, every other integration
 * test fails with a confusing 404; this one names the cause.
 */

const app = createApp()

describe('GET /ping', () => {
  it('answers through the real router with a JSON liveness payload', async () => {
    const res = await request(app).get('/ping')

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(new Date(res.body.time as string).toISOString()).toBe(res.body.time)
  })

  it('returns 404 for the gateway prefix, which the proxy must strip first', async () => {
    const res = await request(app).get('/api/screening/ping')

    expect(res.status).toBe(404)
  })
})
