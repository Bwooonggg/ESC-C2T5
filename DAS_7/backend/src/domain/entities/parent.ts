import { requireStringArray, requireText } from './entity-validation.js'

export interface ParentProps {
    readonly parentId: string
    /**
     * Opaque identifier issued by the platform's identity system. DAS 7 does
     * not create, authenticate, or otherwise manage this identity.
     */
    readonly authUserId: string
    readonly name: string
    readonly studentIds?: readonly string[]
}

export class Parent {
    readonly parentId: string
    readonly authUserId: string
    readonly name: string
    readonly studentIds: readonly string[]

    constructor(props: ParentProps) {
        this.parentId = requireText(props.parentId, 'parentId')
        this.authUserId = requireText(props.authUserId, 'authUserId')
        this.name = requireText(props.name, 'name')
        this.studentIds = requireStringArray(
            props.studentIds ?? [],
            'studentIds',
        )
    }
}
