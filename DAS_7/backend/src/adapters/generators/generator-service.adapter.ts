import type {
    GeneratorAdapter,
    GeneratorClient,
    GeneratorClientResponse,
} from './generator.adapter.js'
import {
    createGeneratorInvocationContext,
    normalizeGeneratorInvocationContext,
    type GeneratorInvocationContext,
} from '../../shared/generator-context.js'

export abstract class GeneratorServiceAdapter<
    TDomainRequest,
    TClientRequest,
    TDomainResult,
> implements GeneratorAdapter<TDomainRequest, TDomainResult>
{
    protected constructor(
        private readonly client: GeneratorClient<TClientRequest>,
    ) {}

    async generate(
        request: TDomainRequest,
        context?: GeneratorInvocationContext,
    ): Promise<TDomainResult> {
        const clientRequest = this.toClientRequest(request)
        const invocationContext = normalizeGeneratorInvocationContext(
            context ?? createGeneratorInvocationContext(),
        )
        const response = await this.client.generate(
            clientRequest,
            invocationContext,
        )

        return this.toDomainResult(response)
    }

    protected abstract toClientRequest(
        request: TDomainRequest,
    ): TClientRequest

    protected abstract toDomainResult(
        response: GeneratorClientResponse,
    ): TDomainResult
}
