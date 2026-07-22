import {
    createPool,
    type Pool,
    type PoolOptions,
} from 'mysql2/promise'
import type { AppConfig } from '../../config/environment.js'

export interface MySqlPoolOptions {
    readonly connectionLimit?: number
    readonly multipleStatements?: boolean
}

/**
 * Creates a pool from validated configuration only. No host, path, or
 * credential is embedded in the infrastructure layer.
 */
export function createMySqlPool(
    config: AppConfig['mysql'],
    options: MySqlPoolOptions = {},
): Pool {
    const poolOptions: PoolOptions = {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        charset: 'utf8mb4',
        timezone: 'Z',
        waitForConnections: true,
        connectionLimit: options.connectionLimit ?? 10,
        queueLimit: 0,
        multipleStatements: options.multipleStatements ?? false,
    }

    return createPool(poolOptions)
}
