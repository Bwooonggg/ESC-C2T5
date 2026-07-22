import { requireValueText } from './value-object-validation.js'
import { ValidationError } from '../errors/domain.error.js'

// ^ : Start of string
// [^\s@]+ : 1+ character that's not a whitespace or @
// \. : literal period
// $ : end of string
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class EmailAddress {
    readonly value: string

    constructor(value: unknown) {
        const normalizedValue = requireValueText(value, 'emailAddress')
            .toLowerCase()

        if (!emailPattern.test(normalizedValue)) {
            throw new ValidationError(
                'emailAddress must be a valid email address.',
            )
        }

        this.value = normalizedValue

        Object.freeze(this)
    }

    equals(other: EmailAddress): boolean {
        return this.value === other.value
    }

    toString(): string {
        return this.value
    }
}
