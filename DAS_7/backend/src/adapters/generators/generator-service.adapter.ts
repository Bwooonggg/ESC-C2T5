import type {
    GeneratorAdapter,
    GeneratorClient,
    GeneratorClientResponse,
} from './generator.adapter.js'

export abstract class GeneratorServiceAdapter<
    TDomainRequest,
    TClientRequest,
    TDomainResult,
> implements GeneratorAdapter<TDomainRequest, TDomainResult>
{
    protected constructor(
        private readonly client: GeneratorClient<TClientRequest>,
    ) {}

    async generate(request: TDomainRequest): Promise<TDomainResult> {
        const clientRequest = this.toClientRequest(request)
        const response = await this.client.generate(clientRequest)

        return this.toDomainResult(response)
    }

    protected abstract toClientRequest(
        request: TDomainRequest,
    ): TClientRequest

    protected abstract toDomainResult(
        response: GeneratorClientResponse,
    ): TDomainResult
}
