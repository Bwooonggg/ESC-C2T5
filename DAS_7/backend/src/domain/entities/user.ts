import { requireBoolean, requireText } from './entity-validation.js'
import { AccountType } from '../value-objects/account-type.js'
import { EmailAddress } from '../value-objects/email-address.js'

export interface UserProps {
    readonly userId: string
    readonly email: EmailAddress
    readonly mobileNumber: string
    readonly passwordHash: string
    readonly accountType: AccountType
    readonly isVerified: boolean
}

export class User {
    readonly userId: string
    readonly email: EmailAddress
    readonly mobileNumber: string
    readonly passwordHash: string
    readonly accountType: AccountType
    readonly isVerified: boolean

    constructor(props: UserProps) {
        this.userId = requireText(props.userId, 'userId')

        if (!(props.email instanceof EmailAddress)) {
            throw new Error('email must be an EmailAddress.')
        }

        if (!(props.accountType instanceof AccountType)) {
            throw new Error('accountType must be an AccountType.')
        }

        this.email = props.email
        this.mobileNumber = requireText(props.mobileNumber, 'mobileNumber')
        this.passwordHash = requireText(props.passwordHash, 'passwordHash')
        this.accountType = props.accountType
        this.isVerified = requireBoolean(props.isVerified, 'isVerified')
    }
}
