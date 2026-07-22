import { requireBoolean, requireText } from './entity-validation.js'

export interface UserProps {
    readonly userId: string
    readonly email: string
    readonly mobileNumber: string
    readonly passwordHash: string
    readonly accountType: string
    readonly isVerified: boolean
}

export class User {
    readonly userId: string
    readonly email: string
    readonly mobileNumber: string
    readonly passwordHash: string
    readonly accountType: string
    readonly isVerified: boolean

    constructor(props: UserProps) {
        this.userId = requireText(props.userId, 'userId')
        this.email = requireText(props.email, 'email')
        this.mobileNumber = requireText(props.mobileNumber, 'mobileNumber')
        this.passwordHash = requireText(props.passwordHash, 'passwordHash')
        this.accountType = requireText(props.accountType, 'accountType')
        this.isVerified = requireBoolean(props.isVerified, 'isVerified')
    }
}
