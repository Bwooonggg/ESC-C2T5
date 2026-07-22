import { requireDate, requireText } from './entity-validation.js'

export interface StudentProps {
    readonly studentId: string
    readonly name: string
    readonly dateOfBirth: Date
    readonly bandLevel: string
}

export class Student {
    readonly studentId: string
    readonly name: string
    readonly dateOfBirth: Date
    readonly bandLevel: string

    constructor(props: StudentProps) {
        this.studentId = requireText(props.studentId, 'studentId')
        this.name = requireText(props.name, 'name')
        this.dateOfBirth = requireDate(props.dateOfBirth, 'dateOfBirth')
        this.bandLevel = requireText(props.bandLevel, 'bandLevel')
    }
}
