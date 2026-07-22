import type {
    SummaryGenerationRequest,
    SummaryGenerationResult,
    SummaryGeneratorPort,
} from '../../modules/track-progress/ports/summary-generator.js'
import { GeneratorServiceAdapter } from './generator-service.adapter.js'
import {
    toDateOnly,
    type GeneratorClientResponse,
} from './generator.adapter.js'
import type {
    SummaryGeneratorClient,
    SummaryGeneratorClientRequest,
} from './summary-generator.client.js'

export class SummaryGeneratorAdapter
    extends GeneratorServiceAdapter<
        SummaryGenerationRequest,
        SummaryGeneratorClientRequest,
        SummaryGenerationResult
    >
    implements SummaryGeneratorPort
{
    constructor(client: SummaryGeneratorClient) {
        super(client)
    }

    protected toClientRequest(
        request: SummaryGenerationRequest,
    ): SummaryGeneratorClientRequest {
        return {
            student: {
                studentId: request.student.studentId,
                name: request.student.name,
                dateOfBirth: toDateOnly(request.student.dateOfBirth),
                bandLevel: request.student.bandLevel,
                currentProgressVersion:
                    request.student.currentProgressVersion,
            },
            records: request.records.map((record) => ({
                recordId: record.recordId,
                studentId: record.studentId,
                date: toDateOnly(record.date),
                skillArea: record.skillArea.value,
                score: record.score,
                notes: record.notes,
            })),
        }
    }

    protected toDomainResult(
        response: GeneratorClientResponse,
    ): SummaryGenerationResult {
        return {
            content: response.content,
            metadata: response.metadata,
        }
    }
}
