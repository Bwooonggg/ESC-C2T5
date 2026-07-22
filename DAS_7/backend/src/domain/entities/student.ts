import { requireDate, requireText } from './entity-validation.js'

export interface StudentProps {
    readonly studentId: string
    readonly name: string
    readonly dateOfBirth: Date
    readonly bandLevel: string
    /**
     * Application-managed snapshot identifier for the student's progress.
     * This persistence detail is not exposed as a separate UML relationship.
     */
    readonly currentProgressVersion?: string
}

export class Student {
    readonly studentId: string
    readonly name: string
    readonly dateOfBirth: Date
    readonly bandLevel: string
    readonly currentProgressVersion: string

    constructor(props: StudentProps) {
        this.studentId = requireText(props.studentId, 'studentId')
        this.name = requireText(props.name, 'name')
        this.dateOfBirth = requireDate(props.dateOfBirth, 'dateOfBirth')
        this.bandLevel = requireText(props.bandLevel, 'bandLevel')
        this.currentProgressVersion = requireText(
            props.currentProgressVersion ?? 'v0',
            'currentProgressVersion',
        )
    }
}
