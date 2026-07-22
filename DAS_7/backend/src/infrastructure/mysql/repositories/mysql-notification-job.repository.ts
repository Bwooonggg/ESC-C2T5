import type {
    Pool,
    PoolConnection,
    RowDataPacket,
} from 'mysql2/promise'
import type {
    NotificationJob,
    NotificationJobRepository,
} from '../../../modules/notifications/ports/notification-job.repository.js'
import { mapNotificationJobRow } from '../mappers/index.js'
import {
    asMysqlRow,
    executeRows,
    executeStatement,
    type MySqlExecutor,
} from './mysql-repository.js'

interface NotificationJobRow extends RowDataPacket {}

export class MySqlNotificationJobRepository
    implements NotificationJobRepository
{
    constructor(private readonly pool: Pool) {}

    async claimDue(
        now: Date,
        leaseExpiresAt: Date,
        limit: number,
    ): Promise<readonly NotificationJob[]> {
        requirePositiveLimit(limit)

        const connection = await this.pool.getConnection()

        try {
            await connection.beginTransaction()
            // MySQL does not reliably bind LIMIT placeholders in prepared
            // statements. The value is validated as a positive integer first.
            const rows = await executeRows<NotificationJobRow>(
                connection,
                `
                    SELECT
                        job_id, parent_id, student_id, summary_id,
                        email_notification_id, scheduled_for, status, attempts,
                        lease_expires_at, completed_at, failed_at, retry_at,
                        last_error
                    FROM notification_jobs
                    WHERE (
                        status = 'pending'
                        AND scheduled_for <= ?
                    )
                    OR (
                        status = 'failed'
                        AND retry_at IS NOT NULL
                        AND retry_at <= ?
                    )
                    OR (
                        status = 'processing'
                        AND lease_expires_at IS NOT NULL
                        AND lease_expires_at <= ?
                    )
                    ORDER BY scheduled_for ASC, job_id ASC
                    LIMIT ${limit}
                    FOR UPDATE SKIP LOCKED
                `,
                [now, now, now],
            )

            const claimed: NotificationJob[] = []

            for (const row of rows) {
                const job = mapNotificationJobRow(asMysqlRow(row))

                await executeStatement(
                    connection,
                    `
                        UPDATE notification_jobs
                        SET
                            status = 'processing',
                            attempts = attempts + 1,
                            lease_expires_at = ?,
                            completed_at = NULL,
                            failed_at = NULL,
                            retry_at = NULL,
                            last_error = NULL
                        WHERE job_id = ?
                    `,
                    [leaseExpiresAt, job.jobId],
                )

                claimed.push({
                    ...job,
                    status: 'processing',
                    attempts: job.attempts + 1,
                    leaseExpiresAt,
                    completedAt: null,
                    failedAt: null,
                    retryAt: null,
                    lastError: null,
                })
            }

            await connection.commit()
            return claimed
        } catch (error) {
            await rollbackQuietly(connection)
            throw error
        } finally {
            connection.release()
        }
    }

    async save(job: NotificationJob): Promise<void> {
        await executeStatement(
            this.pool,
            `
                INSERT INTO notification_jobs
                    (
                        job_id, parent_id, student_id, summary_id,
                        email_notification_id, scheduled_for, status, attempts,
                        lease_expires_at, completed_at, failed_at, retry_at,
                        last_error
                    )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    parent_id = VALUES(parent_id),
                    student_id = VALUES(student_id),
                    summary_id = VALUES(summary_id),
                    email_notification_id = VALUES(email_notification_id),
                    scheduled_for = VALUES(scheduled_for),
                    status = VALUES(status),
                    attempts = VALUES(attempts),
                    lease_expires_at = VALUES(lease_expires_at),
                    completed_at = VALUES(completed_at),
                    failed_at = VALUES(failed_at),
                    retry_at = VALUES(retry_at),
                    last_error = VALUES(last_error)
            `,
            [
                job.jobId,
                job.parentId,
                job.studentId,
                job.summaryId,
                job.emailNotificationId,
                job.scheduledFor,
                job.status,
                job.attempts,
                job.leaseExpiresAt,
                job.completedAt,
                job.failedAt,
                job.retryAt,
                job.lastError,
            ],
        )
    }

    async markCompleted(jobId: string, completedAt: Date): Promise<void> {
        await executeStatement(
            this.pool,
            `
                UPDATE notification_jobs
                SET
                    status = 'completed',
                    lease_expires_at = NULL,
                    completed_at = ?,
                    failed_at = NULL,
                    retry_at = NULL,
                    last_error = NULL
                WHERE job_id = ?
            `,
            [completedAt, jobId],
        )
    }

    async markFailed(
        jobId: string,
        failedAt: Date,
        retryAt: Date | null,
        reason: string,
    ): Promise<void> {
        await executeStatement(
            this.pool,
            `
                UPDATE notification_jobs
                SET
                    status = 'failed',
                    lease_expires_at = NULL,
                    completed_at = NULL,
                    failed_at = ?,
                    retry_at = ?,
                    last_error = ?
                WHERE job_id = ?
            `,
            [failedAt, retryAt, reason, jobId],
        )
    }
}

function requirePositiveLimit(limit: number): void {
    if (!Number.isInteger(limit) || limit < 1) {
        throw new RangeError('limit must be a positive integer.')
    }
}

async function rollbackQuietly(connection: PoolConnection): Promise<void> {
    try {
        await connection.rollback()
    } catch {
        // Preserve the original transaction error.
    }
}
