import { describe, expect, it } from '@jest/globals'
import {
    asJsonObject,
    asNullableJsonObject,
    toProgressVersion,
} from '../../../src/infrastructure/supabase/mappers/write-support.js'

describe('toProgressVersion', () => {
    it.each([
        ['v3', 3],
        ['3', 3],
        ['V0', 0],
        [' v12 ', 12],
    ])('parses %p into %p', (value, expected) => {
        expect(toProgressVersion(value, 'currentProgressVersion')).toBe(expected)
    })

    it.each(['-1', '1.5', 'abc', '', 'v', 'v-1', '3v'])(
        'throws a TypeError for non-version value %p',
        (value) => {
            expect(() =>
                toProgressVersion(value, 'currentProgressVersion'),
            ).toThrow(TypeError)
        },
    )

    it('includes the field name in the error message', () => {
        expect(() => toProgressVersion('nope', 'sourceProgressVersion')).toThrow(
            /sourceProgressVersion/,
        )
    })
})

describe('asJsonObject', () => {
    it('returns a shallow clone with equal contents', () => {
        const source = { a: 1, b: 'two' }
        const result = asJsonObject(source)

        expect(result).toEqual(source)
        expect(result).not.toBe(source)
    })
})

describe('asNullableJsonObject', () => {
    it('returns a shallow clone for an object', () => {
        const source = { a: 1 }
        const result = asNullableJsonObject(source)

        expect(result).toEqual(source)
        expect(result).not.toBe(source)
    })

    it('returns null for a null input', () => {
        expect(asNullableJsonObject(null)).toBeNull()
    })
})
