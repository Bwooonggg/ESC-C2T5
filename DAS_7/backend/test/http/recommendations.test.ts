import { describe, expect, it, jest } from '@jest/globals'
import request from 'supertest'
import { createApiContainer } from '../../src/app/api-container.js'
import { createApiApp } from '../../src/app/create-api-app.js'
import { loadConfig } from '../../src/config/environment.js'
import { Recommendation } from '../../src/domain/entities/recommendation.js'
import { SummaryUnavailableError } from '../../src/domain/errors/summary-unavailable.error.js'
import { GeneratorServiceError } from '../../src/adapters/generators/generator-error.js'
import type { RecommendationModel } from '../../src/modules/track-progress/application/recommendation.model.js'

describe('recommendation routes', () => {
    it('returns the generated recommendation in the frontend envelope', async () => {
        const result = makeRecommendation()
        const requestRecommendations = jest.fn<
            RecommendationModel['requestRecommendations']
        >(async (_studentId, _context) => result)
        const app = createTestApp(requestRecommendations)

        const response = await request(app)
            .post('/api/students/student-1/recommendations')
            .set('x-request-id', 'request-1')
            .set('idempotency-key', 'recommendation-1')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
            ok: true,
            data: {
                recommendationId: 'recommendation-1',
                summaryId: 'summary-1',
                content: 'Practice decoding multisyllabic words.',
                generatedAt: '2026-07-23T12:30:00.000Z',
            },
        })
        expect(requestRecommendations).toHaveBeenCalledWith('student-1', {
            correlationId: 'request-1',
            idempotencyKey: 'recommendation-1',
        })
    })

    it('maps a missing summary to summaryUnavailable', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined)
        const requestRecommendations = jest.fn<
            RecommendationModel['requestRecommendations']
        >(async () => {
            throw new SummaryUnavailableError()
        })
        const app = createTestApp(requestRecommendations)

        const response = await request(app).post(
            '/api/students/student-1/recommendations',
        )

        expect(response.status).toBe(404)
        expect(response.body).toEqual({
            ok: false,
            error: 'summaryUnavailable',
        })
    })

    it('maps recommendation generator failures to recommendationUnavailable', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined)
        const requestRecommendations = jest.fn<
            RecommendationModel['requestRecommendations']
        >(async () => {
            throw new GeneratorServiceError({
                code: 'UNAVAILABLE',
                serviceName: 'RecommendationGeneratorService',
                correlationId: 'request-1',
                message: 'Recommendation generator is unavailable.',
                retryable: true,
            })
        })
        const app = createTestApp(requestRecommendations)

        const response = await request(app).post(
            '/api/students/student-1/recommendations',
        )

        expect(response.status).toBe(503)
        expect(response.body).toEqual({
            ok: false,
            error: 'recommendationUnavailable',
        })
    })

    it('rejects an invalid student ID before invoking the model', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined)
        const requestRecommendations = jest.fn<
            RecommendationModel['requestRecommendations']
        >(async () => makeRecommendation())
        const app = createTestApp(requestRecommendations)

        const response = await request(app).post(
            '/api/students/%20/recommendations',
        )

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
            ok: false,
            error: 'Invalid request.',
        })
        expect(requestRecommendations).not.toHaveBeenCalled()
    })
})

function createTestApp(
    requestRecommendations: RecommendationModel['requestRecommendations'],
) {
    const model = { requestRecommendations } as unknown as RecommendationModel

    return createApiApp(
        createApiContainer(loadConfig({ NODE_ENV: 'test' }), {
            recommendationModel: model,
        }),
    )
}

function makeRecommendation(): Recommendation {
    return new Recommendation({
        recommendationId: 'recommendation-1',
        studentId: 'student-1',
        summaryId: 'summary-1',
        content: 'Practice decoding multisyllabic words.',
        generatedAt: new Date('2026-07-23T12:30:00.000Z'),
    })
}
