import { describe, expect, it } from '@jest/globals'
import request from 'supertest'
import { createApiApp } from '../../src/app/create-api-app.js'

describe('health routes', () => {
    it('returns a successful liveness response', async () => {
        const response = await request(createApiApp()).get('/api/health')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
            ok: true,
            data: { ok: true },
        })
    })

    it('reports that database readiness is not configured', async () => {
        const response = await request(createApiApp()).get('/api/health/ready')

        expect(response.status).toBe(503)
        expect(response.body).toEqual({
            ok: false,
            error: 'Database readiness is not configured yet.',
        })
    })
})
