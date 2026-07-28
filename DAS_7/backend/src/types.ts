export type SkillArea =
    | 'Phonological Awareness' | 'Reading Accuracy' | 'Reading Fluency'
    | 'Spelling' | 'Writing' | 'Comprehension';

export const SKILL_AREAS: readonly SkillArea[] = [
    'Phonological Awareness', 'Reading Accuracy', 'Reading Fluency',
    'Spelling', 'Writing', 'Comprehension',
];

export interface Parent {
    parentId: string;
    name: string;
    email: string;
    mobileNumber: string;
    studentIds: string[];
}

export interface Student {
    studentId: string;
    name: string;
    dateOfBirth: string;   // bare 'YYYY-MM-DD'
    bandLevel: string;     // e.g. 'Band A'
}

export interface ProgressRecord {
    recordId: string;
    studentId: string;
    date: string;          // bare 'YYYY-MM-DD' — the chart depends on this format
    skillArea: SkillArea;
    score: number;         // 0..100
    notes: string;
}

export interface Summary {
    summaryId: string;
    studentId: string;
    content: string;
    generatedAt: string;   // full ISO 8601 datetime
}

export interface Recommendation {
    recommendationId: string;
    summaryId: string;     // keyed to a summary, not directly to the student
    content: string;       // '\n'-joined suggestion lines
    generatedAt: string;
}

export type NotificationFrequency = 'Weekly' | 'Fortnightly' | 'Monthly';

export const NOTIFICATION_FREQUENCIES: readonly NotificationFrequency[] =
    ['Weekly', 'Fortnightly', 'Monthly'];

export interface NotificationPreference {
    parentId: string;
    enabled: boolean;
    frequency: NotificationFrequency;
    recipientEmail: string;
}

// Express request augmentation: the auth middleware attaches the caller.
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            parent?: Parent;
        }
    }
}
export {};
