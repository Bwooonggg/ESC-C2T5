import { describe, expect, it } from '@jest/globals'
import { ProgressRecord } from '../../../src/domain/entities/progress-record.js'
import { Student } from '../../../src/domain/entities/student.js'
import { Summary } from '../../../src/domain/entities/summary.js'
import { SkillArea } from '../../../src/domain/value-objects/skill-area.js'
import { LlmError } from '../../../src/infrastructure/llm/llm-error.js'
import { RecommendationGeneratorAdapter } from '../../../src/infrastructure/llm/recommendation-generator.adapter.js'
import { SummaryGeneratorAdapter } from '../../../src/infrastructure/llm/summary-generator.adapter.js'
import {
    RECOMMENDATION_OUTPUT_NAME,
    RECOMMENDATION_PROMPT_VERSION,
} from '../../../src/infrastructure/llm/prompts/recommendation.prompt.js'
import {
    SUMMARY_OUTPUT_NAME,
    SUMMARY_PROMPT_VERSION,
} from '../../../src/infrastructure/llm/prompts/summary.prompt.js'
import type { GeneratorInvocationContext } from '../../../src/shared/generator-context.js'
import { FakeLlmClient } from '../../fakes/llm-fakes.js'

const context: GeneratorInvocationContext = {
    correlationId: 'request-1',
    idempotencyKey: 'generation-1',
}

describe('SummaryGeneratorAdapter', () => {
    it('sends the summary prompt over the shared LLM client', async () => {
        const llmClient = new FakeLlmClient()
        llmClient.output = { summary: 'The student is improving.' }
        const adapter = new SummaryGeneratorAdapter(llmClient)

        await adapter.generate(
            { student: makeStudent(), records: [makeProgressRecord()] },
            context,
        )

        expect(llmClient.calls).toHaveLength(1)
        expect(llmClient.calls[0].request).toMatchObject({
            operation: 'summary',
            promptVersion: SUMMARY_PROMPT_VERSION,
            outputName: SUMMARY_OUTPUT_NAME,
        })
        expect(JSON.parse(llmClient.calls[0].request.input)).toEqual({
            student: { name: 'A Student', bandLevel: 'Band 2' },
            records: [
                {
                    date: '2026-07-23',
                    skillArea: 'Reading Fluency',
                    score: 82.5,
                    notes: 'Short reading practice.',
                },
            ],
        })
    })

    it('sends no identifiers or date of birth to the provider', async () => {
        const llmClient = new FakeLlmClient()
        llmClient.output = { summary: 'The student is improving.' }
        const adapter = new SummaryGeneratorAdapter(llmClient)

        await adapter.generate(
            { student: makeStudent(), records: [makeProgressRecord()] },
            context,
        )

        const input = llmClient.calls[0].request.input

        for (const forbidden of [
            'studentId',
            'student-1',
            'recordId',
            'record-1',
            'dateOfBirth',
            '2015-06-15',
            'currentProgressVersion',
        ]) {
            expect(input).not.toContain(forbidden)
        }
    })

    it('returns the validated summary content and provider metadata', async () => {
        const llmClient = new FakeLlmClient()
        llmClient.output = { summary: 'The student is improving.' }
        const adapter = new SummaryGeneratorAdapter(llmClient)

        const result = await adapter.generate(
            { student: makeStudent(), records: [makeProgressRecord()] },
            context,
        )

        expect(result).toEqual({
            content: 'The student is improving.',
            metadata: { ...llmClient.metadata },
        })
    })

    it.each([
        ['a blank summary', { summary: '   ' }],
        ['a wrong-shaped payload', { wrong: 'shape' }],
        ['a non-object payload', 'The student is improving.'],
    ])('rejects %s from the provider', async (_label, output) => {
        const llmClient = new FakeLlmClient()
        llmClient.output = output
        const adapter = new SummaryGeneratorAdapter(llmClient)

        await expect(
            adapter.generate(
                { student: makeStudent(), records: [makeProgressRecord()] },
                context,
            ),
        ).rejects.toMatchObject({
            name: 'LlmError',
            code: 'INVALID_RESPONSE',
            operation: 'summary',
            provider: 'test-provider',
            correlationId: 'request-1',
            retryable: false,
        })
    })

    it('propagates a client failure unchanged', async () => {
        const failure = new Error('provider unavailable')
        const llmClient = new FakeLlmClient()
        llmClient.error = failure
        const adapter = new SummaryGeneratorAdapter(llmClient)

        await expect(
            adapter.generate(
                { student: makeStudent(), records: [makeProgressRecord()] },
                context,
            ),
        ).rejects.toBe(failure)
    })

    it('normalizes a supplied invocation context', async () => {
        const llmClient = new FakeLlmClient()
        llmClient.output = { summary: 'The student is improving.' }
        const adapter = new SummaryGeneratorAdapter(llmClient)

        await adapter.generate(
            { student: makeStudent(), records: [makeProgressRecord()] },
            { correlationId: '  request-1  ', idempotencyKey: ' generation-1 ' },
        )

        expect(llmClient.calls[0].context).toEqual(context)
    })

    it('generates an invocation context when none is supplied', async () => {
        const llmClient = new FakeLlmClient()
        llmClient.output = { summary: 'The student is improving.' }
        const adapter = new SummaryGeneratorAdapter(llmClient)

        await adapter.generate({
            student: makeStudent(),
            records: [makeProgressRecord()],
        })

        expect(llmClient.calls[0].context.correlationId).not.toBe('')
        expect(llmClient.calls[0].context.idempotencyKey).not.toBe('')
    })
})

describe('RecommendationGeneratorAdapter', () => {
    it('sends the recommendation prompt over the shared LLM client', async () => {
        const llmClient = new FakeLlmClient()
        llmClient.output = { recommendation: 'Practice reading aloud.' }
        const adapter = new RecommendationGeneratorAdapter(llmClient)

        await adapter.generate({ summary: makeSummary() }, context)

        expect(llmClient.calls).toHaveLength(1)
        expect(llmClient.calls[0].request).toMatchObject({
            operation: 'recommendation',
            promptVersion: RECOMMENDATION_PROMPT_VERSION,
            outputName: RECOMMENDATION_OUTPUT_NAME,
        })
        expect(JSON.parse(llmClient.calls[0].request.input)).toEqual({
            summary: 'The student is improving.',
        })
    })

    it('sends only the summary text, without identifiers', async () => {
        const llmClient = new FakeLlmClient()
        llmClient.output = { recommendation: 'Practice reading aloud.' }
        const adapter = new RecommendationGeneratorAdapter(llmClient)

        await adapter.generate({ summary: makeSummary() }, context)

        const input = llmClient.calls[0].request.input

        for (const forbidden of [
            'summaryId',
            'summary-1',
            'studentId',
            'student-1',
            'sourceProgressVersion',
        ]) {
            expect(input).not.toContain(forbidden)
        }
    })

    it('returns the validated recommendation content and provider metadata', async () => {
        const llmClient = new FakeLlmClient()
        llmClient.output = { recommendation: 'Practice reading aloud.' }
        const adapter = new RecommendationGeneratorAdapter(llmClient)

        const result = await adapter.generate({ summary: makeSummary() }, context)

        expect(result).toEqual({
            content: 'Practice reading aloud.',
            metadata: { ...llmClient.metadata },
        })
    })

    it.each([
        ['a blank recommendation', { recommendation: '   ' }],
        ['a wrong-shaped payload', { wrong: 'shape' }],
    ])('rejects %s from the provider', async (_label, output) => {
        const llmClient = new FakeLlmClient()
        llmClient.output = output
        const adapter = new RecommendationGeneratorAdapter(llmClient)

        await expect(
            adapter.generate({ summary: makeSummary() }, context),
        ).rejects.toMatchObject({
            name: 'LlmError',
            code: 'INVALID_RESPONSE',
            operation: 'recommendation',
            provider: 'test-provider',
            correlationId: 'request-1',
            retryable: false,
        })
    })

    it('propagates a client failure unchanged', async () => {
        const failure = new LlmError({
            code: 'UNAVAILABLE',
            operation: 'recommendation',
            provider: 'test-provider',
            correlationId: 'request-1',
            message: 'The LLM provider is unavailable.',
            retryable: true,
        })
        const llmClient = new FakeLlmClient()
        llmClient.error = failure
        const adapter = new RecommendationGeneratorAdapter(llmClient)

        await expect(
            adapter.generate({ summary: makeSummary() }, context),
        ).rejects.toBe(failure)
    })
})

function makeStudent(): Student {
    return new Student({
        studentId: 'student-1',
        name: 'A Student',
        dateOfBirth: new Date('2015-06-15T00:00:00.000Z'),
        bandLevel: 'Band 2',
        currentProgressVersion: 'v4',
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
        sourceProgressVersion: 'v4',
    })
}
