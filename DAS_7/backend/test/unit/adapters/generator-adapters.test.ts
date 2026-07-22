import { describe, expect, it, jest } from '@jest/globals'
import { ProgressRecord } from '../../../src/domain/entities/progress-record.js'
import { Student } from '../../../src/domain/entities/student.js'
import { Summary } from '../../../src/domain/entities/summary.js'
import { SkillArea } from '../../../src/domain/value-objects/skill-area.js'
import {
    RecommendationGeneratorAdapter,
    SummaryGeneratorAdapter,
} from '../../../src/adapters/generators/index.js'
import type { RecommendationGeneratorClientRequest } from '../../../src/adapters/generators/recommendation-generator.client.js'
import type { SummaryGeneratorClientRequest } from '../../../src/adapters/generators/summary-generator.client.js'

describe('generator adapters', () => {
    it('maps a domain progress snapshot to the summary client', async () => {
        const generate = jest.fn(
            async (request: SummaryGeneratorClientRequest) => {
                expect(request).toEqual({
                    student: {
                        studentId: 'student-1',
                        name: 'A Student',
                        dateOfBirth: '2015-06-15',
                        bandLevel: 'Band 2',
                        currentProgressVersion: 'v4',
                    },
                    records: [
                        {
                            recordId: 'record-1',
                            studentId: 'student-1',
                            date: '2026-07-23',
                            skillArea: 'Reading Fluency',
                            score: 82.5,
                            notes: 'Short reading practice.',
                        },
                    ],
                })

                return {
                    content: 'Summary content',
                    metadata: { providerRequestId: 'summary-1' },
                }
            },
        )
        const adapter = new SummaryGeneratorAdapter({ generate })

        const result = await adapter.generate({
            student: new Student({
                studentId: 'student-1',
                name: 'A Student',
                dateOfBirth: new Date('2015-06-15T00:00:00.000Z'),
                bandLevel: 'Band 2',
                currentProgressVersion: 'v4',
            }),
            records: [
                new ProgressRecord({
                    recordId: 'record-1',
                    studentId: 'student-1',
                    date: new Date('2026-07-23T00:00:00.000Z'),
                    skillArea: new SkillArea('Reading Fluency'),
                    score: 82.5,
                    notes: 'Short reading practice.',
                }),
            ],
        })

        expect(result).toEqual({
            content: 'Summary content',
            metadata: { providerRequestId: 'summary-1' },
        })
        expect(generate).toHaveBeenCalledTimes(1)
    })

    it('maps the persisted summary basis to the recommendation client', async () => {
        const generate = jest.fn(
            async (request: RecommendationGeneratorClientRequest) => {
                expect(request).toEqual({
                    summary: {
                        summaryId: 'summary-1',
                        studentId: 'student-1',
                        content: 'Summary content',
                        generatedAt: '2026-07-23T12:00:00.000Z',
                        sourceProgressVersion: 'v4',
                    },
                })

                return {
                    content: 'Recommendation content',
                    metadata: { providerRequestId: 'recommendation-1' },
                }
            },
        )
        const adapter = new RecommendationGeneratorAdapter({ generate })

        const result = await adapter.generate({
            summary: new Summary({
                summaryId: 'summary-1',
                studentId: 'student-1',
                content: 'Summary content',
                generatedAt: new Date('2026-07-23T12:00:00.000Z'),
                sourceProgressVersion: 'v4',
            }),
        })

        expect(result).toEqual({
            content: 'Recommendation content',
            metadata: { providerRequestId: 'recommendation-1' },
        })
        expect(generate).toHaveBeenCalledTimes(1)
    })

    it('propagates a replaceable client failure unchanged', async () => {
        const failure = new Error('provider unavailable')
        const generate = jest.fn(async () => {
            throw failure
        })
        const adapter = new RecommendationGeneratorAdapter({ generate })

        await expect(
            adapter.generate({
                summary: new Summary({
                    summaryId: 'summary-1',
                    studentId: 'student-1',
                    content: 'Summary content',
                    generatedAt: new Date('2026-07-23T12:00:00.000Z'),
                    sourceProgressVersion: 'v4',
                }),
            }),
        ).rejects.toBe(failure)
    })
})
