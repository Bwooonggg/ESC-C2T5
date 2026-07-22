import { describe, expect, it } from '@jest/globals'
import { EmailNotification } from '../../../src/domain/entities/email-notification.js'
import { NotificationPreference } from '../../../src/domain/entities/notification-preference.js'
import { Parent } from '../../../src/domain/entities/parent.js'
import { ProgressRecord } from '../../../src/domain/entities/progress-record.js'
import { Recommendation } from '../../../src/domain/entities/recommendation.js'
import { Student } from '../../../src/domain/entities/student.js'
import { Summary } from '../../../src/domain/entities/summary.js'
import { User } from '../../../src/domain/entities/user.js'
import { AccountType } from '../../../src/domain/value-objects/account-type.js'
import { EmailAddress } from '../../../src/domain/value-objects/email-address.js'
import { NotificationFrequency } from '../../../src/domain/value-objects/notification-frequency.js'
import { SkillArea } from '../../../src/domain/value-objects/skill-area.js'

const date = new Date('2026-01-20T00:00:00.000Z')

describe('domain entities', () => {
    it('creates a User with identity and credential state', () => {
        const user = new User({
            userId: 'u1',
            email: new EmailAddress('parent@example.com'),
            mobileNumber: '+6512345678',
            passwordHash: 'hashed-password',
            accountType: new AccountType('parent'),
            isVerified: true,
        })

        expect(user).toMatchObject({
            userId: 'u1',
            isVerified: true,
        })
        expect(user.email.value).toBe('parent@example.com')
        expect(user.accountType.value).toBe('parent')
        expect(user.passwordHash).toBe('hashed-password')
    })

    it('models Parent as a User with guarded students', () => {
        const parent = new Parent({
            userId: 'u1',
            parentId: 'p1',
            name: 'A Parent',
            email: new EmailAddress('parent@example.com'),
            mobileNumber: '+6512345678',
            passwordHash: 'hashed-password',
            accountType: new AccountType('parent'),
            isVerified: true,
            studentIds: ['s1', 's2'],
        })

        expect(parent).toBeInstanceOf(User)
        expect(parent.studentIds).toEqual(['s1', 's2'])
    })

    it('creates Student and ProgressRecord entities', () => {
        const student = new Student({
            studentId: 's1',
            name: 'A Student',
            dateOfBirth: new Date('2015-04-10T00:00:00.000Z'),
            bandLevel: 'Band 3',
        })
        const progress = new ProgressRecord({
            recordId: 'r1',
            studentId: student.studentId,
            date,
            skillArea: new SkillArea('Reading Fluency'),
            score: 84,
            notes: 'Improving steadily.',
        })

        expect(student.studentId).toBe(progress.studentId)
        expect(progress.score).toBe(84)
    })

    it('requires progress scores to be between 0 and 100', () => {
        expect(
            () =>
                new ProgressRecord({
                    recordId: 'r1',
                    studentId: 's1',
                    date,
                    skillArea: new SkillArea('Reading Fluency'),
                    score: 101,
                    notes: '',
                }),
        ).toThrow('score must be a number between 0 and 100.')
    })

    it('links a Summary to its source progress version', () => {
        const summary = new Summary({
            summaryId: 'sum1',
            studentId: 's1',
            content: 'The student is progressing well.',
            generatedAt: date,
            sourceProgressVersion: 'progress-v1',
        })

        expect(summary).toMatchObject({
            summaryId: 'sum1',
            studentId: 's1',
            sourceProgressVersion: 'progress-v1',
        })
    })

    it('links a Recommendation to its student and basis Summary', () => {
        const recommendation = new Recommendation({
            recommendationId: 'rec1',
            studentId: 's1',
            summaryId: 'sum1',
            content: 'Continue daily reading practice.',
            generatedAt: date,
        })

        expect(recommendation).toMatchObject({
            studentId: 's1',
            summaryId: 'sum1',
        })
    })

    it('enforces EmailNotification delivery state consistency', () => {
        const pending = new EmailNotification({
            notificationId: 'n1',
            parentId: 'p1',
            summaryId: 'sum1',
            recipientEmail: new EmailAddress('parent@example.com'),
            subject: 'Progress update',
            body: 'Progress summary',
            sentAt: null,
            sent: false,
        })

        expect(pending.sent).toBe(false)
        expect(
            () =>
                new EmailNotification({
                    notificationId: 'n2',
                    parentId: 'p1',
                    summaryId: 'sum1',
                    recipientEmail: new EmailAddress('parent@example.com'),
                    subject: 'Progress update',
                    body: 'Progress summary',
                    sentAt: null,
                    sent: true,
                }),
        ).toThrow('sentAt is required when sent is true.')
    })

    it('creates NotificationPreference for a parent', () => {
        const preference = new NotificationPreference({
            parentId: 'p1',
            enabled: true,
            frequency: new NotificationFrequency('Weekly'),
            recipientEmail: new EmailAddress('parent@example.com'),
        })

        expect(preference.parentId).toBe('p1')
        expect(preference.enabled).toBe(true)
        expect(preference.frequency.value).toBe('Weekly')
        expect(preference.recipientEmail.value).toBe('parent@example.com')
    })
})
