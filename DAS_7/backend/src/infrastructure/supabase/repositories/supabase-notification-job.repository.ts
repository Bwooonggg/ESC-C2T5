import type {
    NotificationJob,
    NotificationJobRepository,
} from '../../../modules/notifications/ports/notification-job.repository.js'
import type { InsightSupabaseClient } from '../clients/supabase-client.js'
import { mapNotificationJobToInsert } from '../mappers/index.js'
import { NotificationJobRpc } from '../rpc/notification-job.rpc.js'
import {
    requirePositiveLimit,
    runSupabase,
} from './repository-support.js'

export interface SupabaseNotificationJobRepositoryOptions {
    readonly leaseOwner: string
}

export class SupabaseNotificationJobRepository
    implements NotificationJobRepository
{
    private readonly rpc: NotificationJobRpc
    private readonly leaseOwner: string

    constructor(
        private readonly client: InsightSupabaseClient,
        options: SupabaseNotificationJobRepositoryOptions,
    ) {
        if (options.leaseOwner.trim() === '') {
            throw new TypeError('leaseOwner is required.')
        }

        this.leaseOwner = options.leaseOwner.trim()
        this.rpc = new NotificationJobRpc(client, this.leaseOwner)
    }

    claimDue(
        now: Date,
        leaseExpiresAt: Date,
        limit: number,
    ): Promise<readonly NotificationJob[]> {
        requirePositiveLimit(limit)
        return this.rpc.claimDue(now, leaseExpiresAt, limit)
    }

    async save(job: NotificationJob): Promise<void> {
        await runSupabase(
            'supabase.notification_jobs.save',
            () =>
                this.client
                    .from('notification_jobs')
                    .upsert(
                        mapNotificationJobToInsert(
                            job,
                            job.status === 'processing'
                                ? this.leaseOwner
                                : null,
                        ),
                        { onConflict: 'job_id' },
                    ),
        )
    }

    async markCompleted(jobId: string, completedAt: Date): Promise<void> {
        await this.rpc.complete(jobId, completedAt)
    }

    async markFailed(
        jobId: string,
        failedAt: Date,
        retryAt: Date | null,
        reason: string,
    ): Promise<void> {
        await this.rpc.fail(jobId, failedAt, retryAt, reason)
    }
}
