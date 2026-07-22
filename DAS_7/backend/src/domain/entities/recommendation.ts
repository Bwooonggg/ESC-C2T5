import { requireDate, requireText } from './entity-validation.js'

export interface RecommendationProps {
    readonly recommendationId: string
    readonly studentId: string
    readonly summaryId: string
    readonly content: string
    readonly generatedAt: Date
}

export class Recommendation {
    readonly recommendationId: string
    readonly studentId: string
    readonly summaryId: string
    readonly content: string
    readonly generatedAt: Date

    constructor(props: RecommendationProps) {
        this.recommendationId = requireText(
            props.recommendationId,
            'recommendationId',
        )
        this.studentId = requireText(props.studentId, 'studentId')
        this.summaryId = requireText(props.summaryId, 'summaryId')
        this.content = requireText(props.content, 'content')
        this.generatedAt = requireDate(props.generatedAt, 'generatedAt')
    }
}
