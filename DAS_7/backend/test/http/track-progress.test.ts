import { describe, expect, it, jest } from '@jest/globals'
import request from 'supertest'
import { createApiContainer } from '../../src/app/api-container.js'
import { createApiApp } from '../../src/app/create-api-app.js'
import { loadConfig } from '../../src/config/environment.js'
import { ProgressRecord } from '../../src/domain/entities/progress-record.js'
import { Student } from '../../src/domain/entities/student.js'
import { Summary } from '../../src/domain/entities/summary.js'
import { ProgressUnavailableError } from '../../src/domain/errors/progress-unavailable.error.js'
import { SkillArea } from '../../src/domain/value-objects/skill-area.js'
import type {
    TrackProgressModel,
    TrackProgressResult,
} from '../../src/modules/track-progress/application/track-progress.model.js'

describe('track progress routes', () => {
    it('returns progress records and a summary in the frontend envelope', async () => {
        const result = makeTrackProgressResult()
        const trackProgress = jest.fn<TrackProgressModel['trackProgress']>(
            async (_studentId, _context) => result,
        )
        const container = createTestContainer(trackProgress)

        const response = await request(createApiApp(container))
            .get('/api/students/student-1/track-progress')
            .set('x-request-id', 'request-1')
            .set('idempotency-key', 'operation-1')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
            ok: true,
            data: {
                progress: [
                    {
                        recordId: 'record-1',
                        studentId: 'student-1',
                        date: '2026-07-23',
                        skillArea: 'Reading Fluency',
                        score: 82.5,
                        notes: 'Short reading practice.',
                    },
                ],
                summary: {
                    summaryId: 'summary-1',
                    studentId: 'student-1',
                    content: 'The student is improving.',
                    generatedAt: '2026-07-23T12:00:00.000Z',
                },
            },
        })
        expect(trackProgress).toHaveBeenCalledWith('student-1', {
            correlationId: 'request-1',
            idempotencyKey: 'operation-1',
        })
    })

    it('returns only the generated summary from the summary endpoint', async () => {
        const result = makeTrackProgressResult()
        const trackProgress = jest.fn<TrackProgressModel['trackProgress']>(
            async (_studentId, _context) => result,
        )
        const container = createTestContainer(trackProgress)

        const response = await request(createApiApp(container)).get(
            '/api/students/student-1/summary',
        )

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
            ok: true,
            data: {
                summaryId: 'summary-1',
                studentId: 'student-1',
                content: 'The student is improving.',
                generatedAt: '2026-07-23T12:00:00.000Z',
            },
        })
        expect(trackProgress).toHaveBeenCalledTimes(1)
    })

    it('maps unavailable progress to the frontend progressUnavailable error', async () => {
        const trackProgress = jest.fn<TrackProgressModel['trackProgress']>(
            async (_studentId, _context) => {
                throw new ProgressUnavailableError()
            },
        )
        const container = createTestContainer(trackProgress)

        const response = await request(createApiApp(container)).get(
            '/api/students/student-1/track-progress',
        )

        expect(response.status).toBe(503)
        expect(response.body).toEqual({
            ok: false,
            error: 'progressUnavailable',
        })
    })

    it('rejects an invalid student ID before invoking the model', async () => {
        const trackProgress = jest.fn<TrackProgressModel['trackProgress']>(
            async (_studentId, _context) => makeTrackProgressResult(),
        )
        const container = createTestContainer(trackProgress)

        const response = await request(createApiApp(container)).get(
            '/api/students/%20/track-progress',
        )

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
            ok: false,
            error: 'Invalid request.',
        })
        expect(trackProgress).not.toHaveBeenCalled()
    })
})

function createTestContainer(
    trackProgress: TrackProgressModel['trackProgress'],
) {
    const model = { trackProgress } as unknown as TrackProgressModel

    return createApiContainer(loadConfig({ NODE_ENV: 'test' }), {
        trackProgressModel: model,
    })
}

function makeTrackProgressResult(): TrackProgressResult {
    const student = new Student({
        studentId: 'student-1',
        name: 'A Student',
        dateOfBirth: new Date('2015-06-15T00:00:00.000Z'),
        bandLevel: 'Band 2',
        currentProgressVersion: 'v1',
    })
    const record = new ProgressRecord({
        recordId: 'record-1',
        studentId: 'student-1',
        date: new Date('2026-07-23T00:00:00.000Z'),
        skillArea: new SkillArea('Reading Fluency'),
        score: 82.5,
        notes: 'Short reading practice.',
    })
    const summary = new Summary({
        summaryId: 'summary-1',
        studentId: 'student-1',
        content: 'The student is improving.',
        generatedAt: new Date('2026-07-23T12:00:00.000Z'),
        sourceProgressVersion: 'v1',
    })

    return { student, records: [record], summary }
}
