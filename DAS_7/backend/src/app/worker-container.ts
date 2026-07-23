import { randomUUID } from 'node:crypto'
import { loadConfig, type AppConfig } from '../config/environment.js'
import {
    createWorkerSupabaseClient,
    type InsightSupabaseClient,
} from '../infrastructure/supabase/clients/index.js'
import {
    SupabaseAuditRepository,
    SupabaseEmailNotificationRepository,
    SupabaseIdempotencyRepository,
    SupabaseNotificationJobRepository,
    SupabaseNotificationPreferenceRepository,
    SupabaseParentRepository,
    SupabaseProgressRecordRepository,
    SupabaseRecommendationRepository,
    SupabaseStudentRepository,
    SupabaseSummaryRepository,
} from '../infrastructure/supabase/repositories/index.js'
import type { AuditRepository } from '../modules/ingestion/ports/audit.repository.js'
import type { IdempotencyRepository } from '../modules/ingestion/ports/idempotency.repository.js'
import type { EmailNotificationRepository } from '../modules/notifications/ports/email-notification.repository.js'
import type { NotificationJobRepository } from '../modules/notifications/ports/notification-job.repository.js'
import type { NotificationPreferenceRepository } from '../modules/preferences/ports/notification-preference.repository.js'
import type { ParentRepository } from '../modules/parents/ports/parent.repository.js'
import type { ProgressRecordRepository } from '../modules/track-progress/ports/progress-record.repository.js'
import type { RecommendationRepository } from '../modules/track-progress/ports/recommendation.repository.js'
import type { StudentRepository } from '../modules/track-progress/ports/student.repository.js'
import type { SummaryRepository } from '../modules/track-progress/ports/summary.repository.js'

export interface WorkerContainer {
    readonly config: AppConfig
    /** Present only in the worker process; never added to the API container. */
    readonly supabaseClient?: InsightSupabaseClient
    /** Worker-only persistence graph built from the secret-key client. */
    readonly persistence?: WorkerPersistence
}

export interface WorkerPersistence {
    readonly parentRepository: ParentRepository
    readonly studentRepository: StudentRepository
    readonly progressRecordRepository: ProgressRecordRepository
    readonly summaryRepository: SummaryRepository
    readonly recommendationRepository: RecommendationRepository
    readonly notificationPreferenceRepository: NotificationPreferenceRepository
    readonly emailNotificationRepository: EmailNotificationRepository
    readonly notificationJobRepository: NotificationJobRepository
    readonly auditRepository: AuditRepository
    readonly idempotencyRepository: IdempotencyRepository
}

export function createWorkerContainer(
    config: AppConfig = loadConfig(),
): WorkerContainer {
    const supabaseClient =
        config.supabase.url !== undefined &&
        config.supabase.secretKey !== undefined
            ? createWorkerSupabaseClient({
                  url: config.supabase.url,
                  schema: config.supabase.schema,
                  secretKey: config.supabase.secretKey,
              })
            : undefined

    return {
        config,
        supabaseClient,
        persistence:
            supabaseClient === undefined
                ? undefined
                : createWorkerPersistence(supabaseClient),
    }
}

function createWorkerPersistence(
    client: InsightSupabaseClient,
): WorkerPersistence {
    return {
        parentRepository: new SupabaseParentRepository(client),
        studentRepository: new SupabaseStudentRepository(client),
        progressRecordRepository: new SupabaseProgressRecordRepository(client, {
            sourceSystem: 'das7-worker',
        }),
        summaryRepository: new SupabaseSummaryRepository(client),
        recommendationRepository: new SupabaseRecommendationRepository(client),
        notificationPreferenceRepository:
            new SupabaseNotificationPreferenceRepository(client),
        emailNotificationRepository: new SupabaseEmailNotificationRepository(
            client,
        ),
        notificationJobRepository: new SupabaseNotificationJobRepository(
            client,
            { leaseOwner: `das7-worker-${randomUUID()}` },
        ),
        auditRepository: new SupabaseAuditRepository(client),
        idempotencyRepository: new SupabaseIdempotencyRepository(client),
    }
}
