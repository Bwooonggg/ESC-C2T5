import { describe, expect, it } from '@jest/globals'
import {
    parsePostgresDate,
    parsePostgresTimestamp,
    toPostgresDate,
    toPostgresTimestamp,
} from '../../../src/infrastructure/supabase/mappers/date-conversions.js'
import { SupabaseRowMappingError } from '../../../src/infrastructure/supabase/errors.js'

describe('parsePostgresTimestamp', () => {
    it('parses a valid PostgreSQL timestamp into a Date', () => {
        const parsed = parsePostgresTimestamp(
            '2026-07-25T09:30:00.000Z',
            'summaries',
            'generated_at',
        )

        expect(parsed).toBeInstanceOf(Date)
        expect(parsed.toISOString()).toBe('2026-07-25T09:30:00.000Z')
    })

    it('throws a SupabaseRowMappingError for an unparseable value', () => {
        expect(() =>
            parsePostgresTimestamp('not-a-timestamp', 'summaries', 'generated_at'),
        ).toThrow(SupabaseRowMappingError)
    })

    it('names the table and field on the thrown error', () => {
        try {
            parsePostgresTimestamp('nope', 'summaries', 'generated_at')
            throw new Error('expected parsePostgresTimestamp to throw')
        } catch (error) {
            expect(error).toBeInstanceOf(SupabaseRowMappingError)
            expect((error as SupabaseRowMappingError).table).toBe('summaries')
            expect((error as Error).message).toContain('generated_at')
        }
    })
})

describe('parsePostgresDate', () => {
    it('parses a valid ISO date at UTC midnight', () => {
        const parsed = parsePostgresDate(
            '2015-04-10',
            'student_profiles',
            'date_of_birth',
        )

        expect(parsed.toISOString()).toBe('2015-04-10T00:00:00.000Z')
    })

    it.each(['2026/01/01', '2026-1-1', '26-01-01', '2026-01-01T00:00:00Z', ''])(
        'rejects malformed date string %p',
        (value) => {
            expect(() =>
                parsePostgresDate(value, 'student_profiles', 'date_of_birth'),
            ).toThrow(SupabaseRowMappingError)
        },
    )

    it.each(['2026-02-30', '2026-13-01', '2026-00-10', '2026-01-32'])(
        'rejects impossible calendar date %p',
        (value) => {
            expect(() =>
                parsePostgresDate(value, 'student_profiles', 'date_of_birth'),
            ).toThrow(SupabaseRowMappingError)
        },
    )
})

describe('toPostgresTimestamp', () => {
    it('serialises a valid Date to an ISO string', () => {
        expect(
            toPostgresTimestamp(new Date('2026-07-25T09:30:00.000Z')),
        ).toBe('2026-07-25T09:30:00.000Z')
    })

    it('throws a TypeError for an invalid Date', () => {
        expect(() => toPostgresTimestamp(new Date('invalid'))).toThrow(TypeError)
    })

    it('throws a TypeError for a non-Date value', () => {
        expect(() =>
            toPostgresTimestamp('2026-07-25' as unknown as Date),
        ).toThrow(TypeError)
    })
})

describe('toPostgresDate', () => {
    it('serialises a valid Date to a YYYY-MM-DD string', () => {
        expect(toPostgresDate(new Date('2015-04-10T00:00:00.000Z'))).toBe(
            '2015-04-10',
        )
    })

    it('throws a TypeError for an invalid Date', () => {
        expect(() => toPostgresDate(new Date('invalid'))).toThrow(TypeError)
    })
})
