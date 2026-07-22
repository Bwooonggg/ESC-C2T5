import type {
    RecommendationGenerationRequest,
    RecommendationGenerationResult,
    RecommendationGeneratorPort,
} from '../../modules/track-progress/ports/recommendation-generator.js'
import { GeneratorServiceAdapter } from './generator-service.adapter.js'
import {
    toIsoTimestamp,
    type GeneratorClientResponse,
} from './generator.adapter.js'
import type {
    RecommendationGeneratorClient,
    RecommendationGeneratorClientRequest,
} from './recommendation-generator.client.js'

export class RecommendationGeneratorAdapter
    extends GeneratorServiceAdapter<
        RecommendationGenerationRequest,
        RecommendationGeneratorClientRequest,
        RecommendationGenerationResult
    >
    implements RecommendationGeneratorPort
{
    constructor(client: RecommendationGeneratorClient) {
        super(client)
    }

    protected toClientRequest(
        request: RecommendationGenerationRequest,
    ): RecommendationGeneratorClientRequest {
        return {
            summary: {
                summaryId: request.summary.summaryId,
                studentId: request.summary.studentId,
                content: request.summary.content,
                generatedAt: toIsoTimestamp(request.summary.generatedAt),
                sourceProgressVersion:
                    request.summary.sourceProgressVersion,
            },
        }
    }

    protected toDomainResult(
        response: GeneratorClientResponse,
    ): RecommendationGenerationResult {
        return {
            content: response.content,
            metadata: response.metadata,
        }
    }
}
