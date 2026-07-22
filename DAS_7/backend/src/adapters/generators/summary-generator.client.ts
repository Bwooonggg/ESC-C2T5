import type { GeneratorClient } from './generator.adapter.js'

export interface SummaryGeneratorClientStudent {
    readonly studentId: string
    readonly name: string
    readonly dateOfBirth: string
    readonly bandLevel: string
    readonly currentProgressVersion: string
}

export interface SummaryGeneratorClientProgressRecord {
    readonly recordId: string
    readonly studentId: string
    readonly date: string
    readonly skillArea: string
    readonly score: number
    readonly notes: string
}

export interface SummaryGeneratorClientRequest {
    readonly student: SummaryGeneratorClientStudent
    readonly records: readonly SummaryGeneratorClientProgressRecord[]
}

export interface SummaryGeneratorClient
    extends GeneratorClient<SummaryGeneratorClientRequest> {}
