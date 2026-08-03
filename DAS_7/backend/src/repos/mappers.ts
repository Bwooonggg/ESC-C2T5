import type {
    Parent, Student, ProgressRecord, Summary, Recommendation,
    NotificationPreference, NotificationFrequency, SkillArea,
} from '../types.js';

// Row shapes as Postgres returns them through supabase-js: snake_case columns,
// `date` columns already bare 'YYYY-MM-DD' strings and `timestamptz` columns
// already ISO 8601 strings. Nothing here parses a Date — strings pass straight
// through, because the frontend chart depends on the bare date format.

export interface ParentRow {
    parent_id: string;
    auth_user_id: string | null;
    name: string;
    email: string;
    mobile_number: string;
}

export interface StudentRow {
    student_id: string;
    name: string;
    date_of_birth: string;
    band_level: string;
}

export interface ProgressRecordRow {
    record_id: string;
    student_id: string;
    date: string;
    skill_area: string;
    score: number;
    notes: string;
    created_at?: string;
}

export interface SummaryRow {
    summary_id: string;
    student_id: string;
    content: string;
    generated_at: string;
}

export interface RecommendationRow {
    recommendation_id: string;
    summary_id: string;
    content: string;
    generated_at: string;
}

export interface NotificationPreferenceRow {
    parent_id: string;
    enabled: boolean;
    frequency: string;
    recipient_email: string;
}

/** The guardianship links live in a separate table, so ids are passed in. */
export function rowToParent(row: ParentRow, studentIds: string[]): Parent {
    return {
        parentId: row.parent_id,
        name: row.name,
        email: row.email,
        mobileNumber: row.mobile_number,
        studentIds,
    };
}

export function rowToStudent(row: StudentRow): Student {
    return {
        studentId: row.student_id,
        name: row.name,
        dateOfBirth: row.date_of_birth,
        bandLevel: row.band_level,
    };
}

export function rowToProgressRecord(row: ProgressRecordRow): ProgressRecord {
    return {
        recordId: row.record_id,
        studentId: row.student_id,
        date: row.date,
        // The column carries a check constraint listing exactly the SkillArea values.
        skillArea: row.skill_area as SkillArea,
        score: row.score,
        notes: row.notes,
    };
}

export function rowToSummary(row: SummaryRow): Summary {
    return {
        summaryId: row.summary_id,
        studentId: row.student_id,
        content: row.content,
        generatedAt: row.generated_at,
    };
}

export function rowToRecommendation(row: RecommendationRow): Recommendation {
    return {
        recommendationId: row.recommendation_id,
        summaryId: row.summary_id,
        content: row.content,
        generatedAt: row.generated_at,
    };
}

export function rowToPreference(row: NotificationPreferenceRow): NotificationPreference {
    return {
        parentId: row.parent_id,
        enabled: row.enabled,
        // Constrained to the three frequencies by a check constraint on the column.
        frequency: row.frequency as NotificationFrequency,
        recipientEmail: row.recipient_email,
    };
}
