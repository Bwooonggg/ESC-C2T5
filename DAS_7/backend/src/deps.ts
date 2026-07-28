import type { AppConfig } from './config.js';
import type {
    Parent, Student, ProgressRecord, Summary, Recommendation,
    NotificationPreference,
} from './types.js';
import type { LlmClient } from './adapters/llm/llm-client.js';
import type { EmailProvider } from './adapters/email/email-provider.js';

export interface ParentRepo {
    byAuthUserId(authUserId: string): Promise<Parent | null>;
    byId(parentId: string): Promise<Parent | null>;
}

export interface StudentRepo {
    byId(studentId: string): Promise<Student | null>;
    listByParent(parentId: string): Promise<Student[]>;
    isGuardian(parentId: string, studentId: string): Promise<boolean>;
}

export interface ProgressRepo {
    /** All records for the student, ordered by date ascending. */
    listByStudent(studentId: string): Promise<ProgressRecord[]>;
    /** ISO timestamp of the most recently INSERTED record (internal created_at), or null. */
    latestCreatedAt(studentId: string): Promise<string | null>;
}

export interface SummaryRepo {
    latestByStudent(studentId: string): Promise<Summary | null>;
    insert(input: { studentId: string; content: string }): Promise<Summary>;
}

export interface RecommendationRepo {
    insert(input: { summaryId: string; content: string }): Promise<Recommendation>;
}

export interface PreferenceRepo {
    byParentId(parentId: string): Promise<NotificationPreference | null>;
    upsert(pref: NotificationPreference): Promise<NotificationPreference>;
    listEnabled(): Promise<NotificationPreference[]>;
}

export interface EmailNotificationRepo {
    /** ISO sent_at of the newest notification for this parent, or null if none. */
    lastSentAt(parentId: string): Promise<string | null>;
    insert(input: {
        parentId: string;
        summaryId: string | null;
        recipientEmail: string;
        subject: string;
        body: string;
    }): Promise<void>;
}

export interface InsightService {
    trackProgress(studentId: string): Promise<{ progress: ProgressRecord[]; summary: Summary }>;
    getSummary(studentId: string): Promise<Summary>;
    createRecommendation(studentId: string): Promise<Recommendation>;
}

export interface PreferenceService {
    get(parentId: string): Promise<NotificationPreference>;
    /** Validates the raw request body; throws ValidationError with a human-readable message. */
    save(parentId: string, body: unknown): Promise<NotificationPreference>;
}

export type NotifyOutcome = 'parentNotified' | 'notificationFailed';

export interface NotifierService {
    notifyParent(parentId: string, now: Date): Promise<NotifyOutcome>;
    runDueNotifications(now: Date): Promise<Array<{ parentId: string; outcome: NotifyOutcome }>>;
}

export interface Deps {
    config: AppConfig;
    parentRepo: ParentRepo;
    studentRepo: StudentRepo;
    progressRepo: ProgressRepo;
    summaryRepo: SummaryRepo;
    recommendationRepo: RecommendationRepo;
    preferenceRepo: PreferenceRepo;
    emailNotificationRepo: EmailNotificationRepo;
    llm: LlmClient;
    email: EmailProvider;
    insightService: InsightService;
    preferenceService: PreferenceService;
    notifierService: NotifierService;
}
