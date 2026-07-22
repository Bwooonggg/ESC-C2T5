export interface GeneratorClientResponse {
    readonly content: string
    readonly metadata?: Readonly<Record<string, unknown>>
}

export interface GeneratorClient<TRequest> {
    generate(request: TRequest): Promise<GeneratorClientResponse>
}

export interface GeneratorAdapter<TRequest, TResult> {
    generate(request: TRequest): Promise<TResult>
}

export function toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10)
}

export function toIsoTimestamp(date: Date): string {
    return date.toISOString()
}
