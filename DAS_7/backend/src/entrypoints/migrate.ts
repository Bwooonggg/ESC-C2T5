import { loadConfig } from '../config/environment.js'
import { fileURLToPath } from 'node:url'
import {
    getMigrationLockName,
    runMigrations,
} from '../infrastructure/mysql/migration-runner.js'
import { createMySqlPool } from '../infrastructure/mysql/pool.js'

const migrationsDirectory = fileURLToPath(
    new URL('../../db/migrations/', import.meta.url),
)

async function main(): Promise<void> {
    const config = loadConfig()
    const pool = createMySqlPool(config.mysql, {
        connectionLimit: 1,
        // Migration files are trusted repository code, not request data.
        multipleStatements: true,
    })

    try {
        const connection = await pool.getConnection()

        try {
            const result = await runMigrations(connection, {
                migrationsDirectory,
                lockName: getMigrationLockName(config.mysql.database),
            })

            for (const migration of result.applied) {
                console.log(`[migrate] applied ${migration}`)
            }

            console.log(
                `[migrate] complete: ${result.applied.length} applied, ${result.skipped.length} already applied`,
            )
        } finally {
            connection.release()
        }
    } finally {
        await pool.end()
    }
}

void main().catch((error: unknown) => {
    console.error('[migrate] failed:', error)
    process.exitCode = 1
})
