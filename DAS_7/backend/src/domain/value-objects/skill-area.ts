import { requireKnownValue } from './value-object-validation.js'

export const SKILL_AREA_VALUES = [
    'Phonological Awareness',
    'Reading Accuracy',
    'Reading Fluency',
    'Spelling',
    'Writing',
    'Comprehension',
] as const

export type SkillAreaValue = (typeof SKILL_AREA_VALUES)[number]

export class SkillArea {
    readonly value: SkillAreaValue

    constructor(value: unknown) {
        this.value = requireKnownValue(value, 'skillArea', SKILL_AREA_VALUES)

        Object.freeze(this)
    }

    equals(other: SkillArea): boolean {
        return this.value === other.value
    }

    toString(): string {
        return this.value
    }
}
