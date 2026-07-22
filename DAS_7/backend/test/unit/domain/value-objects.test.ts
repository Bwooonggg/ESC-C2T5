import { describe, expect, it } from '@jest/globals'
import { AccountType } from '../../../src/domain/value-objects/account-type.js'
import { EmailAddress } from '../../../src/domain/value-objects/email-address.js'
import { NotificationFrequency } from '../../../src/domain/value-objects/notification-frequency.js'
import { SkillArea } from '../../../src/domain/value-objects/skill-area.js'

describe('domain value objects', () => {
    it('normalizes email addresses and compares them by value', () => {
        const first = new EmailAddress(' Parent@Example.com ')
        const second = new EmailAddress('parent@example.com')

        expect(first.value).toBe('parent@example.com')
        expect(first.equals(second)).toBe(true)
        expect(first.toString()).toBe('parent@example.com')
        expect(Object.isFrozen(first)).toBe(true)
    })

    it('rejects malformed email addresses', () => {
        expect(() => new EmailAddress('not-an-email')).toThrow(
            'emailAddress must be a valid email address.',
        )
    })

    it('accepts supported account types and rejects unknown types', () => {
        expect(new AccountType('parent').value).toBe('parent')
        expect(new AccountType('staff').value).toBe('staff')
        expect(new AccountType('system').value).toBe('system')
        expect(() => new AccountType('student')).toThrow(
            'accountType must be one of: parent, staff, system.',
        )
    })

    it('accepts the frontend skill-area vocabulary and rejects unknown areas', () => {
        const skillArea = new SkillArea('Reading Fluency')

        expect(skillArea.value).toBe('Reading Fluency')
        expect(() => new SkillArea('Mathematics')).toThrow(
            'skillArea must be one of: Phonological Awareness, Reading Accuracy, Reading Fluency, Spelling, Writing, Comprehension.',
        )
    })

    it('accepts supported notification frequencies and rejects unknown frequencies', () => {
        const frequency = new NotificationFrequency('Weekly')

        expect(frequency.value).toBe('Weekly')
        expect(frequency.equals(new NotificationFrequency('Weekly'))).toBe(true)
        expect(() => new NotificationFrequency('Daily')).toThrow(
            'notificationFrequency must be one of: Weekly, Fortnightly, Monthly.',
        )
    })
})
