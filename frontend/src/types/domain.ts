// DAS 7 domain types, transcribed from the PM2 class diagram.
//
// Keep this file synchronized with DAS_7/src/types.ts.
//
// Interfaces and string-literal unions are used because the frontend compiles
// with `erasableSyntaxOnly`, which does not allow enums or namespaces.

// `skillArea: String` in the class diagram, narrowed for chart colouring.
export type SkillArea =
  | 'Phonological Awareness'
  | 'Reading Accuracy'
  | 'Reading Fluency'
  | 'Spelling'
  | 'Writing'
  | 'Comprehension';

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
  dateOfBirth: string;
  bandLevel: string;
}

export interface ProgressRecord {
  recordId: string;
  studentId: string;
  date: string;
  skillArea: SkillArea;
  score: number;
  notes: string;
}

export interface Summary {
  summaryId: string;
  studentId: string;
  content: string;
  generatedAt: string;
}

export interface Recommendation {
  recommendationId: string;
  summaryId: string;
  content: string;
  generatedAt: string;
}

export interface EmailNotification {
  notificationId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  sentAt: string | null;
  sent: boolean;
  summaryId?: string;
}

// PM2 delta (see plan gap 3.1). Add this to the class diagram.
export type NotificationFrequency = 'Weekly' | 'Fortnightly' | 'Monthly';

export interface NotificationPreference {
  parentId: string;
  enabled: boolean;
  frequency: NotificationFrequency;
  recipientEmail: string;
}

// Transport shape for REST responses. The mock backend wraps entities in this
// envelope so callers can handle success and failure consistently.
export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
