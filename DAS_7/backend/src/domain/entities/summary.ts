import { requireDate, requireText } from './entity-validation.js'

export interface SummaryProps {
    readonly summaryId: string
    readonly studentId: string
    readonly content: string
    readonly generatedAt: Date
    readonly sourceProgressVersion: string
}

export class Summary {
    readonly summaryId: string
    readonly studentId: string
    readonly content: string
    readonly generatedAt: Date
    readonly sourceProgressVersion: string

    constructor(props: SummaryProps) {
        this.summaryId = requireText(props.summaryId, 'summaryId')
        this.studentId = requireText(props.studentId, 'studentId')
        this.content = requireText(props.content, 'content')
        this.generatedAt = requireDate(props.generatedAt, 'generatedAt')
        this.sourceProgressVersion = requireText(
            props.sourceProgressVersion,
            'sourceProgressVersion',
        )
    }
}
