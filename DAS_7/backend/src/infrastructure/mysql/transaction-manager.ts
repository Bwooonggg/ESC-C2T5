import type { Pool, PoolConnection } from 'mysql2/promise'

export type MySqlTransactionWork<TResult> = (
    connection: PoolConnection,
) => Promise<TResult>

/**
 * Runs related MySQL operations on one checked-out connection and guarantees
 * that the connection is committed, rolled back, and released in that order.
 */
export async function withMySqlTransaction<TResult>(
    pool: Pool,
    work: MySqlTransactionWork<TResult>,
): Promise<TResult> {
    const connection = await pool.getConnection()
    let transactionStarted = false

    try {
        await connection.beginTransaction()
        transactionStarted = true

        const result = await work(connection)

        await connection.commit()
        return result
    } catch (error) {
        if (transactionStarted) {
            await rollbackQuietly(connection)
        }

        throw error
    } finally {
        connection.release()
    }
}

async function rollbackQuietly(connection: PoolConnection): Promise<void> {
    try {
        await connection.rollback()
    } catch {
        // Preserve the original transaction error.
    }
}
