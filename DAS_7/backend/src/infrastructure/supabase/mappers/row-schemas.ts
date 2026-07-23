import { z } from 'zod'
import type { Database, Json } from '../generated/database.types.js'
import { SupabaseRowMappingError } from '../errors.js'

type InsightTables = Database['insight']['Tables']

export type AuditEventRow = InsightTables['audit_events']['Row']
export type EmailNotificationRow =
    InsightTables['email_notifications']['Row']
export type IdempotencyRecordRow =
    InsightTables['idempotency_records']['Row']
export type NotificationJobRow = InsightTables['notification_jobs']['Row']
export type NotificationPreferenceRow =
    InsightTables['notification_preferences']['Row']
export type ParentProfileRow = InsightTables['parent_profiles']['Row']
export type ParentStudentRow = InsightTables['parent_students']['Row']
export type ProgressRecordRow = InsightTables['progress_records']['Row']
export type RecommendationRow = InsightTables['recommendations']['Row']
export type StudentProfileRow = InsightTables['student_profiles']['Row']
export type SummaryRow = InsightTables['summaries']['Row']

const jsonObjectSchema = z.record(z.string(), z.unknown())
const uuidSchema = z.string().uuid()
const timestampSchema = z.string().trim().min(1)
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const jsonSchema: z.ZodType<Json> = z.lazy(() =>
    z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.record(z.string(), jsonSchema.optional()),
        z.array(jsonSchema),
    ]),
)

export const auditEventRowSchema = z
    .object({
        event_id: uuidSchema,
        actor_user_id: uuidSchema.nullable(),
        action: z.string().trim().min(1),
        entity_type: z.string().trim().min(1),
        entity_id: z.string().trim().min(1),
        occurred_at: timestampSchema,
        metadata: jsonObjectSchema,
        created_at: timestampSchema,
    })
    .passthrough()

export const emailNotificationRowSchema = z
    .object({
        notification_id: uuidSchema,
        parent_id: uuidSchema,
        student_id: uuidSchema,
        summary_id: uuidSchema,
        recipient_email: z.string().trim().min(1),
        subject: z.string().trim().min(1),
        body: z.string().trim().min(1),
        sent_at: timestampSchema.nullable(),
        sent: z.boolean(),
        provider_message_id: z.string().nullable(),
        created_at: timestampSchema,
        updated_at: timestampSchema,
    })
    .passthrough()

export const idempotencyRecordRowSchema = z
    .object({
        scope: z.string().trim().min(1),
        operation: z.string().trim().min(1),
        idempotency_key: z.string().trim().min(1),
        request_hash: z.string().regex(/^[0-9a-fA-F]{64}$/),
        status: z.enum(['processing', 'completed', 'failed']),
        response_status: z.number().int().nullable(),
        response_body: jsonSchema.nullable(),
        expires_at: timestampSchema,
        completed_at: timestampSchema.nullable(),
        failed_at: timestampSchema.nullable(),
        created_at: timestampSchema,
    })
    .passthrough()

export const notificationJobRowSchema = z
    .object({
        job_id: uuidSchema,
        parent_id: uuidSchema,
        student_id: uuidSchema,
        summary_id: uuidSchema.nullable(),
        email_notification_id: uuidSchema.nullable(),
        scheduled_for: timestampSchema,
        status: z.enum(['pending', 'processing', 'completed', 'failed']),
        attempts: z.number().int().nonnegative(),
        lease_owner: z.string().nullable(),
        lease_expires_at: timestampSchema.nullable(),
        completed_at: timestampSchema.nullable(),
        failed_at: timestampSchema.nullable(),
        retry_at: timestampSchema.nullable(),
        last_error: z.string().nullable(),
        created_at: timestampSchema,
        updated_at: timestampSchema,
    })
    .passthrough()

export const notificationPreferenceRowSchema = z
    .object({
        parent_id: uuidSchema,
        enabled: z.boolean(),
        frequency: z.enum(['Weekly', 'Fortnightly', 'Monthly']),
        recipient_email: z.string().trim().min(1),
        created_at: timestampSchema,
        updated_at: timestampSchema,
    })
    .passthrough()

export const parentProfileRowSchema = z
    .object({
        parent_id: uuidSchema,
        auth_user_id: uuidSchema,
        name: z.string().trim().min(1),
        created_at: timestampSchema,
        updated_at: timestampSchema,
    })
    .passthrough()

export const parentStudentRowSchema = z
    .object({
        parent_id: uuidSchema,
        student_id: uuidSchema,
        assigned_at: timestampSchema,
    })
    .passthrough()

export const progressRecordRowSchema = z
    .object({
        record_id: uuidSchema,
        student_id: uuidSchema,
        assessment_date: dateSchema,
        skill_area: z.string().trim().min(1),
        score: z.number().finite().min(0).max(100),
        notes: z.string(),
        progress_version: z.number().int().positive(),
        source_system: z.string().trim().min(1),
        source_record_id: z.string().trim().min(1),
        source_revision: z.number().int().positive(),
        supersedes_record_id: uuidSchema.nullable(),
        correction_reason: z.string().nullable(),
        created_at: timestampSchema,
    })
    .passthrough()

export const recommendationRowSchema = z
    .object({
        recommendation_id: uuidSchema,
        student_id: uuidSchema,
        summary_id: uuidSchema,
        content: z.string().trim().min(1),
        generated_at: timestampSchema,
        provider: z.string().nullable(),
        model: z.string().nullable(),
        prompt_version: z.string().nullable(),
        provider_request_id: z.string().nullable(),
        generation_metadata: jsonObjectSchema,
        created_at: timestampSchema,
    })
    .passthrough()

export const studentProfileRowSchema = z
    .object({
        student_id: uuidSchema,
        name: z.string().trim().min(1),
        date_of_birth: dateSchema,
        band_level: z.string().trim().min(1),
        current_progress_version: z.number().int().nonnegative(),
        created_at: timestampSchema,
        updated_at: timestampSchema,
    })
    .passthrough()

export const summaryRowSchema = z
    .object({
        summary_id: uuidSchema,
        student_id: uuidSchema,
        content: z.string().trim().min(1),
        generated_at: timestampSchema,
        source_progress_version: z.number().int().positive(),
        provider: z.string().nullable(),
        model: z.string().nullable(),
        prompt_version: z.string().nullable(),
        provider_request_id: z.string().nullable(),
        generation_metadata: jsonObjectSchema,
        created_at: timestampSchema,
    })
    .passthrough()

export function parseInsightRow<T>(
    schema: z.ZodType<T>,
    value: unknown,
    table: string,
): T {
    const parsed = schema.safeParse(value)

    if (parsed.success) {
        return parsed.data
    }

    const details = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '<row>'}: ${issue.message}`)
        .join('; ')

    throw new SupabaseRowMappingError(table, details)
}
