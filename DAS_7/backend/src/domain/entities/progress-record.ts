import {
    allowText,
    requireDate,
    requireScore,
    requireText,
} from './entity-validation.js'

export interface ProgressRecordProps {
    readonly recordId: string
    readonly studentId: string
    readonly date: Date
    readonly skillArea: string
    readonly score: number
    readonly notes: string
}

export class ProgressRecord {
    readonly recordId: string
    readonly studentId: string
    readonly date: Date
    readonly skillArea: string
    readonly score: number
    readonly notes: string

    constructor(props: ProgressRecordProps) {
        this.recordId = requireText(props.recordId, 'recordId')
        this.studentId = requireText(props.studentId, 'studentId')
        this.date = requireDate(props.date, 'date')
        this.skillArea = requireText(props.skillArea, 'skillArea')
        this.score = requireScore(props.score, 'score')
        this.notes = allowText(props.notes, 'notes')
    }
}
