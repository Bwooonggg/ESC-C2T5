import {
    requireStringArray,
    requireText,
} from './entity-validation.js'
import { User, type UserProps } from './user.js'

export interface ParentProps extends UserProps {
    readonly parentId: string
    readonly name: string
    readonly studentIds?: readonly string[]
}

export class Parent extends User {
    readonly parentId: string
    readonly name: string
    readonly studentIds: readonly string[]

    constructor(props: ParentProps) {
        super(props)

        this.parentId = requireText(props.parentId, 'parentId')
        this.name = requireText(props.name, 'name')
        this.studentIds = requireStringArray(
            props.studentIds ?? [],
            'studentIds',
        )
    }
}
