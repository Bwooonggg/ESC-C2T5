// DAS 7 domain types — transcribed from the PM2 class diagram.
//
// This file is copied BYTE-IDENTICAL between:
//   DAS_7/mock_backend/src/types/domain.ts
//   DAS_7/frontend/src/types/domain.ts
// It is the single source of truth for entity shapes. Change one, change both.
//
// Interfaces only: the frontend compiles with `erasableSyntaxOnly`, which forbids
// `enum` and `namespace`. String-literal unions cover what enums would have.

export type SkillArea =                    // 'skillArea: String' in the diagram; narrowed for chart colouring
  | 'Phonological Awareness' | 'Reading Accuracy' | 'Reading Fluency'
  | 'Spelling' | 'Writing' | 'Comprehension'

export interface Parent { parentId: string; name: string; email: string; mobileNumber: string; studentIds: string[] }
export interface Student { studentId: string; name: string; dateOfBirth: string; bandLevel: string }
export interface ProgressRecord { recordId: string; studentId: string; date: string; skillArea: SkillArea; score: number; notes: string }
export interface Summary { summaryId: string; studentId: string; content: string; generatedAt: string }
export interface Recommendation { recommendationId: string; summaryId: string; content: string; generatedAt: string }
export interface EmailNotification { notificationId: string; recipientEmail: string; subject: string; body: string; sentAt: string | null; sent: boolean; summaryId?: string }

// PM2 delta — see plan gap 3.1. Needs adding to the class diagram.
export type NotificationFrequency = 'Weekly' | 'Fortnightly' | 'Monthly'
export interface NotificationPreference { parentId: string; enabled: boolean; frequency: NotificationFrequency; recipientEmail: string }

// Transport shape for every REST response. Not a PM2 entity — it is how the
// mock backend wraps the entities above so clients handle success and failure
// through one branch instead of guessing from the HTTP status alone.
export type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string }
