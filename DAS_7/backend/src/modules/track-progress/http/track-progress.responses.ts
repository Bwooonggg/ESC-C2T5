import type { ProgressRecord } from '../../../domain/entities/progress-record.js'
import type { Summary } from '../../../domain/entities/summary.js'

export interface TrackProgressResponse {
    readonly progress: readonly ProgressRecordResponse[]
    readonly summary: SummaryResponse
}

export interface ProgressRecordResponse {
    readonly recordId: string
    readonly studentId: string
    readonly date: string
    readonly skillArea: string
    readonly score: number
    readonly notes: string
}

export interface SummaryResponse {
    readonly summaryId: string
    readonly studentId: string
    readonly content: string
    readonly generatedAt: string
}

export function toTrackProgressResponse(
    records: readonly ProgressRecord[],
    summary: Summary,
): TrackProgressResponse {
    return {
        progress: records.map(toProgressRecordResponse),
        summary: toSummaryResponse(summary),
    }
}

export function toProgressRecordResponse(
    record: ProgressRecord,
): ProgressRecordResponse {
    return {
        recordId: record.recordId,
        studentId: record.studentId,
        date: toDateOnly(record.date),
        skillArea: record.skillArea.value,
        score: record.score,
        notes: record.notes,
    }
}

export function toSummaryResponse(summary: Summary): SummaryResponse {
    return {
        summaryId: summary.summaryId,
        studentId: summary.studentId,
        content: summary.content,
        generatedAt: summary.generatedAt.toISOString(),
    }
}

function toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10)
}
