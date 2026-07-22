import type {
    ExecuteValues,
    ResultSetHeader,
    RowDataPacket,
} from 'mysql2'
import type { Pool as PromisePool } from 'mysql2/promise'
import type { MysqlRow } from '../mappers/index.js'

/**
 * Both a pool and a checked-out PoolConnection satisfy this boundary. This
 * lets ordinary repository calls use the pool while future workflows can pass
 * a transaction connection without changing repository contracts.
 */
export type MySqlExecutor = Pick<PromisePool, 'execute'>

export async function executeRows<TRow extends RowDataPacket>(
    executor: MySqlExecutor,
    sql: string,
    values: readonly ExecuteValues[] = [],
): Promise<readonly TRow[]> {
    const [rows] = await executor.execute<TRow[]>(sql, [...values])
    return rows
}

export async function executeStatement(
    executor: MySqlExecutor,
    sql: string,
    values: readonly ExecuteValues[] = [],
): Promise<ResultSetHeader> {
    const [result] = await executor.execute<ResultSetHeader>(
        sql,
        [...values],
    )
    return result
}

export function asMysqlRow(row: RowDataPacket): MysqlRow {
    return row as unknown as MysqlRow
}
