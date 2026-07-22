import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PoolConnection } from 'mysql2/promise'

const migrationFilePattern = /^(\d{4,})_([a-z0-9][a-z0-9_]*)\.sql$/i
const defaultLockTimeoutSeconds = 30

export const migrationTableName = 'schema_migrations'

export interface MigrationFile {
    readonly id: string
    readonly sequence: number
    readonly path: string
    readonly sql: string
    readonly checksum: string
}

export interface MigrationRunnerOptions {
    readonly migrationsDirectory: string
    readonly lockName?: string
    readonly lockTimeoutSeconds?: number
}

export interface MigrationRunResult {
    readonly applied: readonly string[]
    readonly skipped: readonly string[]
}

interface AppliedMigrationRow {
    readonly migration_id: string
    readonly checksum: string
}

export function normalizeMigrationSql(sql: string): string {
    return sql.replace(/\r\n?/g, '\n')
}

export function migrationChecksum(sql: string): string {
    return createHash('sha256')
        .update(normalizeMigrationSql(sql), 'utf8')
        .digest('hex')
}

/**
 * Uses a database-derived advisory-lock name. GET_LOCK is scoped to the MySQL
 * server, so two migration processes cannot mutate the same schema at once.
 */
export function getMigrationLockName(databaseName: string): string {
    const databaseHash = createHash('sha256')
        .update(databaseName, 'utf8')
        .digest('hex')
        .slice(0, 48)

    return `das7:migrations:${databaseHash}`
}

export async function discoverMigrationFiles(
    migrationsDirectory: string,
): Promise<readonly MigrationFile[]> {
    const entries = await readdir(migrationsDirectory, { withFileTypes: true })
    const sqlEntries = entries.filter(
        (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.sql'),
    )

    const migrations = await Promise.all(
        sqlEntries.map(async (entry) => {
            const match = migrationFilePattern.exec(entry.name)

            if (match === null) {
                throw new Error(
                    `Invalid migration filename "${entry.name}". Expected NNNN_name.sql.`,
                )
            }

            const rawSql = await readFile(
                join(migrationsDirectory, entry.name),
                'utf8',
            )

            const sql = normalizeMigrationSql(rawSql)

            if (sql.trim() === '') {
                throw new Error(`Migration "${entry.name}" is empty.`)
            }

            return {
                id: entry.name,
                sequence: Number(match[1]),
                path: join(migrationsDirectory, entry.name),
                sql,
                checksum: migrationChecksum(sql),
            }
        }),
    )

    const seenSequences = new Set<number>()

    for (const migration of migrations) {
        if (seenSequences.has(migration.sequence)) {
            throw new Error(
                `Duplicate migration sequence "${migration.sequence}" detected.`,
            )
        }

        seenSequences.add(migration.sequence)
    }

    return migrations.sort((left, right) => left.sequence - right.sequence)
}

/**
 * Applies pending trusted SQL migrations using one locked connection.
 * MySQL DDL can implicitly commit, so each file is recorded only after its
 * statements complete successfully; migrations should remain forward-only.
 */
export async function runMigrations(
    connection: PoolConnection,
    options: MigrationRunnerOptions,
): Promise<MigrationRunResult> {
    const migrations = await discoverMigrationFiles(options.migrationsDirectory)
    const lockName = options.lockName ?? getMigrationLockName('das7')
    const lockTimeoutSeconds = options.lockTimeoutSeconds ?? defaultLockTimeoutSeconds

    if (
        !Number.isInteger(lockTimeoutSeconds) ||
        lockTimeoutSeconds < 0
    ) {
        throw new Error('Migration lock timeout must be a non-negative integer.')
    }

    let lockAcquired = false

    try {
        await acquireMigrationLock(connection, lockName, lockTimeoutSeconds)
        lockAcquired = true
        await ensureMigrationTable(connection)

        const appliedRows = await readAppliedMigrations(connection)
        const migrationsById = new Map(
            migrations.map((migration) => [migration.id, migration]),
        )

        for (const applied of appliedRows) {
            if (!migrationsById.has(applied.migration_id)) {
                throw new Error(
                    `Applied migration "${applied.migration_id}" is missing from the migration directory.`,
                )
            }
        }

        const applied = new Map(
            appliedRows.map((migration) => [
                migration.migration_id,
                migration.checksum,
            ]),
        )

        for (const migration of migrations) {
            const storedChecksum = applied.get(migration.id)

            if (
                storedChecksum !== undefined &&
                storedChecksum !== migration.checksum
            ) {
                throw new Error(
                    `Checksum mismatch for applied migration "${migration.id}".`,
                )
            }
        }

        const newlyApplied: string[] = []
        const skipped: string[] = []
        let pendingMigrationFound = false

        for (const migration of migrations) {
            const storedChecksum = applied.get(migration.id)

            if (storedChecksum !== undefined) {
                if (pendingMigrationFound) {
                    throw new Error(
                        `Applied migration "${migration.id}" follows a pending migration.`,
                    )
                }

                skipped.push(migration.id)
                continue
            }

            pendingMigrationFound = true
            await connection.query(migration.sql)
            await connection.execute(
                `
                    INSERT INTO ${migrationTableName}
                        (migration_id, checksum, applied_at)
                    VALUES (?, ?, UTC_TIMESTAMP(3))
                `,
                [migration.id, migration.checksum],
            )
            newlyApplied.push(migration.id)
        }

        return {
            applied: newlyApplied,
            skipped,
        }
    } finally {
        if (lockAcquired) {
            await releaseMigrationLock(connection, lockName)
        }
    }
}

async function ensureMigrationTable(connection: PoolConnection): Promise<void> {
    await connection.query(`
        CREATE TABLE IF NOT EXISTS ${migrationTableName} (
            migration_id VARCHAR(255) NOT NULL,
            checksum CHAR(64) NOT NULL,
            applied_at DATETIME(3) NOT NULL,
            PRIMARY KEY (migration_id)
        ) ENGINE = InnoDB
            DEFAULT CHARACTER SET utf8mb4
            COLLATE = utf8mb4_unicode_ci
    `)
}

async function readAppliedMigrations(
    connection: PoolConnection,
): Promise<readonly AppliedMigrationRow[]> {
    const [rows] = await connection.query(`
        SELECT migration_id, checksum
        FROM ${migrationTableName}
        ORDER BY migration_id
    `)

    return rows as AppliedMigrationRow[]
}

async function acquireMigrationLock(
    connection: PoolConnection,
    lockName: string,
    timeoutSeconds: number,
): Promise<void> {
    const [rows] = await connection.query(
        'SELECT GET_LOCK(?, ?) AS acquired',
        [lockName, timeoutSeconds],
    )
    const acquired = (rows as Array<{ acquired: number | null }>)[0]?.acquired

    if (acquired !== 1) {
        throw new Error(
            `Could not acquire the migration lock within ${timeoutSeconds} seconds.`,
        )
    }
}

async function releaseMigrationLock(
    connection: PoolConnection,
    lockName: string,
): Promise<void> {
    await connection.query('SELECT RELEASE_LOCK(?)', [lockName])
}
