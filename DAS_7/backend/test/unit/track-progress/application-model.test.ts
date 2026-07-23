import { describe, expect, it } from '@jest/globals'
import { Recommendation } from '../../../src/domain/entities/recommendation.js'
import { ProgressRecord } from '../../../src/domain/entities/progress-record.js'
import { Student } from '../../../src/domain/entities/student.js'
import { Summary } from '../../../src/domain/entities/summary.js'
import { ProgressUnavailableError } from '../../../src/domain/errors/progress-unavailable.error.js'
import { SummaryUnavailableError } from '../../../src/domain/errors/summary-unavailable.error.js'
import { ValidationError } from '../../../src/domain/errors/domain.error.js'
import { SkillArea } from '../../../src/domain/value-objects/skill-area.js'
import { RecommendationModel } from '../../../src/modules/track-progress/application/recommendation.model.js'
import { TrackProgressModel } from '../../../src/modules/track-progress/application/track-progress.model.js'
import type { ProgressRecordRepository } from '../../../src/modules/track-progress/ports/progress-record.repository.js'
import type { RecommendationRepository } from '../../../src/modules/track-progress/ports/recommendation.repository.js'
import type { StudentRepository } from '../../../src/modules/track-progress/ports/student.repository.js'
import type { SummaryRepository } from '../../../src/modules/track-progress/ports/summary.repository.js'
import type { SummaryGeneratorPort } from '../../../src/modules/track-progress/ports/summary-generator.js'
import type { GeneratorInvocationContext } from '../../../src/shared/generator-context.js'
import {
    FakeRecommendationGenerator,
    FakeSummaryGenerator,
} from '../../fakes/generator-fakes.js'

const context: GeneratorInvocationContext = {
    correlationId: 'request-1',
    idempotencyKey: 'generation-1',
}

describe('TrackProgressModel', () => {
    it('generates and persists a summary from one progress snapshot', async () => {
        const student = makeStudent('v1')
        const records = [makeProgressRecord()]
        const studentRepository = new FakeStudentRepository([
            student,
            student,
        ])
        const progressRecordRepository = new FakeProgressRecordRepository(
            records,
        )
        const summaryRepository = new FakeSummaryRepository()
        const summaryGenerator = new FakeSummaryGenerator()
        const model = new TrackProgressModel({
            studentRepository,
            progressRecordRepository,
            summaryRepository,
            summaryGenerator,
            now: () => new Date('2026-07-23T12:00:00.000Z'),
            createId: () => 'summary-1',
        })

        const result = await model.trackProgress('student-1', context)

        expect(result.summary).toEqual(
            new Summary({
                summaryId: 'summary-1',
                studentId: 'student-1',
                content: 'Fake summary',
                generatedAt: new Date('2026-07-23T12:00:00.000Z'),
                sourceProgressVersion: 'v1',
            }),
        )
        expect(result.records).toEqual(records)
        expect(summaryRepository.saved).toEqual([result.summary])
        expect(summaryGenerator.calls).toHaveLength(1)
        expect(summaryGenerator.calls[0].request).toEqual({
            student,
            records,
        })
        expect(summaryGenerator.calls[0].context).toBe(context)
    })

    it('coalesces concurrent requests for the same progress snapshot', async () => {
        const student = makeStudent('v1')
        const records = [makeProgressRecord()]
        let generationStartedResolve!: () => void
        let generationRelease!: () => void
        let generatorCalls = 0
        const started = new Promise<void>((resolve) => {
            generationStartedResolve = resolve
        })
        const generationGate = new Promise<void>((resolve) => {
            generationRelease = resolve
        })
        const summaryGenerator: SummaryGeneratorPort = {
            generate: async () => {
                generatorCalls += 1
                generationStartedResolve()
                await generationGate
                return { content: 'Shared summary' }
            },
        }
        const model = new TrackProgressModel({
            studentRepository: new FakeStudentRepository([student, student]),
            progressRecordRepository: new FakeProgressRecordRepository(records),
            summaryRepository: new FakeSummaryRepository(),
            summaryGenerator,
            createId: () => 'shared-summary',
        })

        const first = model.trackProgress('student-1', context)
        await started
        const second = model.trackProgress('student-1', {
            correlationId: 'request-2',
            idempotencyKey: 'generation-2',
        })
        await Promise.resolve()
        await Promise.resolve()

        expect(generatorCalls).toBe(1)
        generationRelease()

        const [firstResult, secondResult] = await Promise.all([first, second])

        expect(firstResult).toBe(secondResult)
    })

    it('returns progress unavailable without calling the generator when records are empty', async () => {
        const student = makeStudent('v1')
        const summaryGenerator = new FakeSummaryGenerator()
        const summaryRepository = new FakeSummaryRepository()
        const model = new TrackProgressModel({
            studentRepository: new FakeStudentRepository([student]),
            progressRecordRepository: new FakeProgressRecordRepository([]),
            summaryRepository,
            summaryGenerator,
        })

        await expect(model.trackProgress('student-1', context)).rejects.toBeInstanceOf(
            ProgressUnavailableError,
        )
        expect(summaryGenerator.calls).toHaveLength(0)
        expect(summaryRepository.saved).toHaveLength(0)
    })

    it('regenerates with the same context when the progress version changes', async () => {
        const firstStudent = makeStudent('v1')
        const currentStudent = makeStudent('v2')
        const summaryGenerator = new FakeSummaryGenerator()
        const summaryRepository = new FakeSummaryRepository()
        const model = new TrackProgressModel({
            studentRepository: new FakeStudentRepository([
                firstStudent,
                currentStudent,
                currentStudent,
            ]),
            progressRecordRepository: new FakeProgressRecordRepository([
                makeProgressRecord(),
            ]),
            summaryRepository,
            summaryGenerator,
            createId: () => 'summary-v2',
        })

        const result = await model.trackProgress('student-1', context)

        expect(summaryGenerator.calls).toHaveLength(2)
        expect(summaryGenerator.calls[0].context).toBe(context)
        expect(summaryGenerator.calls[1].context).toBe(context)
        expect(result.summary.sourceProgressVersion).toBe('v2')
        expect(summaryRepository.saved).toEqual([result.summary])
    })

    it('does not persist a summary when the generator fails', async () => {
        const failure = new Error('generator unavailable')
        const summaryGenerator = new FakeSummaryGenerator()
        summaryGenerator.error = failure
        const summaryRepository = new FakeSummaryRepository()
        const model = new TrackProgressModel({
            studentRepository: new FakeStudentRepository([makeStudent('v1')]),
            progressRecordRepository: new FakeProgressRecordRepository([
                makeProgressRecord(),
            ]),
            summaryRepository,
            summaryGenerator,
        })

        await expect(model.trackProgress('student-1', context)).rejects.toBe(
            failure,
        )
        expect(summaryRepository.saved).toHaveLength(0)
    })

    it('does not persist invalid generated content', async () => {
        const summaryGenerator = new FakeSummaryGenerator()
        summaryGenerator.result = { content: '   ' }
        const summaryRepository = new FakeSummaryRepository()
        const model = new TrackProgressModel({
            studentRepository: new FakeStudentRepository([
                makeStudent('v1'),
            ]),
            progressRecordRepository: new FakeProgressRecordRepository([
                makeProgressRecord(),
            ]),
            summaryRepository,
            summaryGenerator,
        })

        await expect(model.trackProgress('student-1', context)).rejects.toBeInstanceOf(
            ValidationError,
        )
        expect(summaryRepository.saved).toHaveLength(0)
    })
})

describe('RecommendationModel', () => {
    it('generates and persists a recommendation from the latest summary', async () => {
        const summary = makeSummary()
        const recommendationGenerator = new FakeRecommendationGenerator()
        const recommendationRepository = new FakeRecommendationRepository()
        const model = new RecommendationModel({
            summaryRepository: new FakeSummaryRepository(summary),
            recommendationRepository,
            recommendationGenerator,
            now: () => new Date('2026-07-23T12:30:00.000Z'),
            createId: () => 'recommendation-1',
        })

        const result = await model.requestRecommendations(
            'student-1',
            context,
        )

        expect(result).toEqual(
            new Recommendation({
                recommendationId: 'recommendation-1',
                studentId: 'student-1',
                summaryId: 'summary-1',
                content: 'Fake recommendation',
                generatedAt: new Date('2026-07-23T12:30:00.000Z'),
            }),
        )
        expect(recommendationGenerator.calls).toHaveLength(1)
        expect(recommendationGenerator.calls[0].request).toEqual({ summary })
        expect(recommendationGenerator.calls[0].context).toBe(context)
        expect(recommendationRepository.saved).toEqual([result])
    })

    it('does not call the generator when no summary exists', async () => {
        const recommendationGenerator = new FakeRecommendationGenerator()
        const recommendationRepository = new FakeRecommendationRepository()
        const model = new RecommendationModel({
            summaryRepository: new FakeSummaryRepository(),
            recommendationRepository,
            recommendationGenerator,
        })

        await expect(
            model.requestRecommendations('student-1', context),
        ).rejects.toBeInstanceOf(SummaryUnavailableError)
        expect(recommendationGenerator.calls).toHaveLength(0)
        expect(recommendationRepository.saved).toHaveLength(0)
    })
})

class FakeStudentRepository implements StudentRepository {
    private readonly responses: readonly (Student | null)[]
    private index = 0

    constructor(responses: readonly (Student | null)[]) {
        this.responses = responses
    }

    async findById(_studentId: string): Promise<Student | null> {
        const response =
            this.responses[Math.min(this.index, this.responses.length - 1)] ??
            null
        this.index += 1
        return response
    }

    async save(_student: Student): Promise<void> {}
}

class FakeProgressRecordRepository implements ProgressRecordRepository {
    constructor(private readonly records: readonly ProgressRecord[]) {}

    async findByStudentId(
        _studentId: string,
    ): Promise<readonly ProgressRecord[]> {
        return this.records
    }

    async save(_record: ProgressRecord): Promise<void> {}

    async saveMany(_records: readonly ProgressRecord[]): Promise<void> {}
}

class FakeSummaryRepository implements SummaryRepository {
    readonly saved: Summary[] = []

    constructor(private latest: Summary | null = null) {}

    async findLatestByStudentId(_studentId: string): Promise<Summary | null> {
        return this.latest
    }

    async findHistoryByStudentId(
        _studentId: string,
    ): Promise<readonly Summary[]> {
        return this.saved
    }

    async save(summary: Summary): Promise<void> {
        this.saved.push(summary)
        this.latest = summary
    }
}

class FakeRecommendationRepository implements RecommendationRepository {
    readonly saved: Recommendation[] = []

    async findByStudentId(
        _studentId: string,
    ): Promise<readonly Recommendation[]> {
        return this.saved
    }

    async findBySummaryId(
        _summaryId: string,
    ): Promise<readonly Recommendation[]> {
        return this.saved
    }

    async save(recommendation: Recommendation): Promise<void> {
        this.saved.push(recommendation)
    }
}

function makeStudent(currentProgressVersion: string): Student {
    return new Student({
        studentId: 'student-1',
        name: 'A Student',
        dateOfBirth: new Date('2015-06-15T00:00:00.000Z'),
        bandLevel: 'Band 2',
        currentProgressVersion,
    })
}

function makeProgressRecord(): ProgressRecord {
    return new ProgressRecord({
        recordId: 'record-1',
        studentId: 'student-1',
        date: new Date('2026-07-23T00:00:00.000Z'),
        skillArea: new SkillArea('Reading Fluency'),
        score: 82.5,
        notes: 'Short reading practice.',
    })
}

function makeSummary(): Summary {
    return new Summary({
        summaryId: 'summary-1',
        studentId: 'student-1',
        content: 'The student is improving.',
        generatedAt: new Date('2026-07-23T12:00:00.000Z'),
        sourceProgressVersion: 'v1',
    })
}
