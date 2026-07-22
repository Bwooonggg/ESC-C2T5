import { requireKnownValue } from './value-object-validation.js'

export const ACCOUNT_TYPE_VALUES = ['parent', 'staff', 'system'] as const

export type AccountTypeValue = (typeof ACCOUNT_TYPE_VALUES)[number]

export class AccountType {
    readonly value: AccountTypeValue

    constructor(value: unknown) {
        this.value = requireKnownValue(
            value,
            'accountType',
            ACCOUNT_TYPE_VALUES,
        )

        Object.freeze(this)
    }

    equals(other: AccountType): boolean {
        return this.value === other.value
    }

    toString(): string {
        return this.value
    }
}
