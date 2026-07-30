import {
    rowToParent, rowToStudent, rowToProgressRecord, rowToSummary,
    rowToRecommendation, rowToPreference,
} from '../../src/repos/mappers.js';

// Offline only: these are pure snake_case → camelCase functions, so no Supabase
// client is involved. The rows below are shaped exactly as supabase-js hands
// them back — `date` columns already bare 'YYYY-MM-DD', timestamps already ISO.

describe('rowToParent', () => {
    const row = {
        parent_id: 'p-1',
        auth_user_id: 'auth-1',
        name: 'Aisha Rahman',
        email: 'parent.demo@dial.sg',
        mobile_number: '+65 8123 4567',
    };

    it('maps every field to its camelCase counterpart', () => {
        expect(rowToParent(row, [])).toEqual({
            parentId: 'p-1',
            name: 'Aisha Rahman',
            email: 'parent.demo@dial.sg',
            mobileNumber: '+65 8123 4567',
            studentIds: [],
        });
    });

    it('attaches the student ids it is given (they come from a separate table)', () => {
        expect(rowToParent(row, ['s-1', 's-2']).studentIds).toEqual(['s-1', 's-2']);
    });

    it('does not expose auth_user_id on the domain object', () => {
        expect(rowToParent(row, [])).not.toHaveProperty('authUserId');
    });
});

describe('rowToStudent', () => {
    it('maps every field to its camelCase counterpart', () => {
        expect(rowToStudent({
            student_id: 's-1',
            name: 'Nur Hakim',
            date_of_birth: '2015-04-12',
            band_level: 'Band A',
        })).toEqual({
            studentId: 's-1',
            name: 'Nur Hakim',
            dateOfBirth: '2015-04-12',
            bandLevel: 'Band A',
        });
    });

    it('passes the date of birth through as a bare date string', () => {
        const student = rowToStudent({
            student_id: 's-1',
            name: 'Nur Hakim',
            date_of_birth: '2015-04-12',
            band_level: 'Band A',
        });

        expect(student.dateOfBirth).toBe('2015-04-12');
        expect(typeof student.dateOfBirth).toBe('string');
    });
});

describe('rowToProgressRecord', () => {
    const row = {
        record_id: 'r-1',
        student_id: 's-1',
        date: '2026-03-17',
        skill_area: 'Reading Fluency',
        score: 72,
        notes: 'More consistent, still slow under time pressure.',
        created_at: '2026-03-17T09:15:00.000Z',
    };

    it('maps every field to its camelCase counterpart', () => {
        expect(rowToProgressRecord(row)).toEqual({
            recordId: 'r-1',
            studentId: 's-1',
            date: '2026-03-17',
            skillArea: 'Reading Fluency',
            score: 72,
            notes: 'More consistent, still slow under time pressure.',
        });
    });

    it('leaves the date untouched — the chart depends on the bare format', () => {
        expect(rowToProgressRecord(row).date).toBe('2026-03-17');
    });

    it('drops the internal created_at column', () => {
        expect(rowToProgressRecord(row)).not.toHaveProperty('createdAt');
    });
});

describe('rowToSummary', () => {
    it('maps every field and keeps generated_at as the ISO string it came as', () => {
        const summary = rowToSummary({
            summary_id: 'sum-1',
            student_id: 's-1',
            content: 'Nur is making steady gains in reading accuracy.',
            generated_at: '2026-05-19T02:30:00.000Z',
        });

        expect(summary).toEqual({
            summaryId: 'sum-1',
            studentId: 's-1',
            content: 'Nur is making steady gains in reading accuracy.',
            generatedAt: '2026-05-19T02:30:00.000Z',
        });
        expect(typeof summary.generatedAt).toBe('string');
    });
});

describe('rowToRecommendation', () => {
    it('maps every field, keeping the summary key and the joined content lines', () => {
        expect(rowToRecommendation({
            recommendation_id: 'rec-1',
            summary_id: 'sum-1',
            content: 'Read aloud for 10 minutes daily.\nPractise blending sounds.',
            generated_at: '2026-05-19T02:31:00.000Z',
        })).toEqual({
            recommendationId: 'rec-1',
            summaryId: 'sum-1',
            content: 'Read aloud for 10 minutes daily.\nPractise blending sounds.',
            generatedAt: '2026-05-19T02:31:00.000Z',
        });
    });
});

describe('rowToPreference', () => {
    it('maps every field to its camelCase counterpart', () => {
        expect(rowToPreference({
            parent_id: 'p-1',
            enabled: true,
            frequency: 'Fortnightly',
            recipient_email: 'parent.demo@dial.sg',
        })).toEqual({
            parentId: 'p-1',
            enabled: true,
            frequency: 'Fortnightly',
            recipientEmail: 'parent.demo@dial.sg',
        });
    });

    it('preserves enabled = false rather than dropping it', () => {
        expect(rowToPreference({
            parent_id: 'p-1',
            enabled: false,
            frequency: 'Monthly',
            recipient_email: 'parent.demo@dial.sg',
        }).enabled).toBe(false);
    });
});
