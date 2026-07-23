import type { InsightSupabaseClient } from '../clients/supabase-client.js'
import {
    mapNotificationJobRow,
} from '../mappers/domain-mappers.js'
import {
    notificationJobRowSchema,
    parseInsightRow,
    type NotificationJobRow,
} from '../mappers/row-schemas.js'
import { runSupabase } from '../repositories/repository-support.js'
import type {
    NotificationJob,
} from '../../../modules/notifications/ports/notification-job.repository.js'

export class NotificationJobRpc {
    constructor(
        private readonly client: InsightSupabaseClient,
        private readonly leaseOwner: string,
    ) {}

    async claimDue(
        now: Date,
        leaseExpiresAt: Date,
        limit: number,
    ): Promise<readonly NotificationJob[]> {
        const rows = await runSupabase(
            'supabase.rpc.claim_notification_jobs',
            () =>
                this.client.rpc('claim_notification_jobs', {
                    p_now: now.toISOString(),
                    p_lease_expires_at: leaseExpiresAt.toISOString(),
                    p_limit: limit,
                    p_lease_owner: this.leaseOwner,
                }),
        )

        return (rows ?? []).map((row) => mapNotificationJobRow(parseJobRow(row)))
    }

    async complete(
        jobId: string,
        completedAt: Date,
    ): Promise<NotificationJob> {
        const row = await runSupabase(
            'supabase.rpc.complete_notification_job',
            () =>
                this.client.rpc('complete_notification_job', {
                    p_job_id: jobId,
                    p_lease_owner: this.leaseOwner,
                    p_completed_at: completedAt.toISOString(),
                }),
        )

        return mapNotificationJobRow(parseJobRow(row))
    }

    async fail(
        jobId: string,
        failedAt: Date,
        retryAt: Date | null,
        reason: string,
    ): Promise<NotificationJob> {
        const row = await runSupabase(
            'supabase.rpc.fail_notification_job',
            () =>
                this.client.rpc('fail_notification_job', {
                    p_job_id: jobId,
                    p_lease_owner: this.leaseOwner,
                    p_failed_at: failedAt.toISOString(),
                    p_retry_at: nullableRpcArgument(retryAt?.toISOString() ?? null),
                    p_reason: reason,
                }),
        )

        return mapNotificationJobRow(parseJobRow(row))
    }
}

function parseJobRow(value: unknown): NotificationJobRow {
    return parseInsightRow(
        notificationJobRowSchema,
        value,
        'notification_jobs',
    )
}

/** Generated Supabase types currently model nullable RPC arguments as strings. */
function nullableRpcArgument(value: string | null): string {
    return value as unknown as string
}

