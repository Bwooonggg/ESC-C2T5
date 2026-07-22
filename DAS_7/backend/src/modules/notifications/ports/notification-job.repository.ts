export type NotificationJobStatus =
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'

export interface NotificationJob {
    readonly jobId: string
    readonly parentId: string
    readonly studentId: string
    readonly scheduledFor: Date
    readonly status: NotificationJobStatus
    readonly attempts: number
    readonly leaseExpiresAt: Date | null
}

export interface NotificationJobRepository {
    claimDue(
        now: Date,
        leaseExpiresAt: Date,
        limit: number,
    ): Promise<readonly NotificationJob[]>
    save(job: NotificationJob): Promise<void>
    markCompleted(jobId: string, completedAt: Date): Promise<void>
    markFailed(
        jobId: string,
        failedAt: Date,
        retryAt: Date | null,
        reason: string,
    ): Promise<void>
}
