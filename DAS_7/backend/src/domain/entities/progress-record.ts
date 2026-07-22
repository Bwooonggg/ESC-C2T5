import {
    allowText,
    requireDate,
    requireScore,
    requireText,
} from './entity-validation.js'
import { ValidationError } from '../errors/domain.error.js'
import { SkillArea } from '../value-objects/skill-area.js'

export interface ProgressRecordProps {
    readonly recordId: string
    readonly studentId: string
    readonly date: Date
    readonly skillArea: SkillArea
    readonly score: number
    readonly notes: string
}

export class ProgressRecord {
    readonly recordId: string
    readonly studentId: string
    readonly date: Date
    readonly skillArea: SkillArea
    readonly score: number
    readonly notes: string

    constructor(props: ProgressRecordProps) {
        this.recordId = requireText(props.recordId, 'recordId')
        this.studentId = requireText(props.studentId, 'studentId')
        this.date = requireDate(props.date, 'date')

        if (!(props.skillArea instanceof SkillArea)) {
            throw new ValidationError('skillArea must be a SkillArea.')
        }

        this.skillArea = props.skillArea
        this.score = requireScore(props.score, 'score')
        this.notes = allowText(props.notes, 'notes')
    }
}
