import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.ts'

/**
 * IT-13 — the smallest end-to-end slice: app.ts mounts screenerRoutes.ts under
 * /api and express.json()/cors() sit in front of it. If the mount prefix or the
 * router export ever breaks, every other integration test fails with a
 * confusing 404; this one names the cause.
 */

const app = createApp()

describe('GET /api/ping', () => {
  it('answers through the real router with a JSON liveness payload', async () => {
    const res = await request(app).get('/api/ping')

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(new Date(res.body.time as string).toISOString()).toBe(res.body.time)
  })

  it('returns 404 for a path outside the /api mount', async () => {
    const res = await request(app).get('/ping')

    expect(res.status).toBe(404)
  })
})
