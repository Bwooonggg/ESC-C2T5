import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { PoolConnection } from 'mysql2/promise'
import {
    discoverMigrationFiles,
    migrationChecksum,
    normalizeMigrationSql,
    runMigrations,
} from '../../../src/infrastructure/mysql/migration-runner.js'

interface AppliedMigration {
    migration_id: string
    checksum: string
}

interface FakeMigrationState {
    applied: AppliedMigration[]
    executedSql: string[]
}

const temporaryDirectories: string[] = []

afterEach(async () => {
    await Promise.all(
        temporaryDirectories.splice(0).map((directory) =>
            rm(directory, { recursive: true, force: true }),
        ),
    )
})

describe('migration runner', () => {
    it('normalizes line endings and orders migration files by sequence', async () => {
        const directory = await createTemporaryDirectory()
        await writeFile(join(directory, '0002_second.sql'), 'SELECT 2;\r\n')
        await writeFile(join(directory, '0001_first.sql'), 'SELECT 1;\n')

        const migrations = await discoverMigrationFiles(directory)

        expect(migrations.map((migration) => migration.id)).toEqual([
            '0001_first.sql',
            '0002_second.sql',
        ])
        expect(migrations[1]?.sql).toBe('SELECT 2;\n')
        expect(migrationChecksum('SELECT 2;\r\n')).toBe(
            migrationChecksum('SELECT 2;\n'),
        )
        expect(normalizeMigrationSql('a\r\nb\r\nc')).toBe('a\nb\nc')
    })

    it('applies pending migrations and records their checksums', async () => {
        const directory = await createTemporaryDirectory()
        await writeFile(join(directory, '0001_first.sql'), 'SELECT 1;\n')
        await writeFile(join(directory, '0002_second.sql'), 'SELECT 2;\n')
        const state: FakeMigrationState = {
            applied: [],
            executedSql: [],
        }
        const fake = createFakeConnection(state)

        const result = await runMigrations(fake.connection, {
            migrationsDirectory: directory,
            lockName: 'test-migration-lock',
        })

        expect(result.applied).toEqual([
            '0001_first.sql',
            '0002_second.sql',
        ])
        expect(result.skipped).toEqual([])
        expect(state.applied).toEqual([
            {
                migration_id: '0001_first.sql',
                checksum: migrationChecksum('SELECT 1;\n'),
            },
            {
                migration_id: '0002_second.sql',
                checksum: migrationChecksum('SELECT 2;\n'),
            },
        ])
        expect(state.executedSql).toEqual(
            expect.arrayContaining(['SELECT 1;\n', 'SELECT 2;\n']),
        )
    })

    it('skips matching applied migrations and rejects checksum drift', async () => {
        const directory = await createTemporaryDirectory()
        await writeFile(join(directory, '0001_first.sql'), 'SELECT 1;\n')
        const state: FakeMigrationState = {
            applied: [
                {
                    migration_id: '0001_first.sql',
                    checksum: migrationChecksum('SELECT 1;\n'),
                },
            ],
            executedSql: [],
        }
        const fake = createFakeConnection(state)

        const result = await runMigrations(fake.connection, {
            migrationsDirectory: directory,
            lockName: 'test-migration-lock',
        })

        expect(result.applied).toEqual([])
        expect(result.skipped).toEqual(['0001_first.sql'])
        expect(state.executedSql).not.toContain('SELECT 1;\n')

        await writeFile(join(directory, '0001_first.sql'), 'SELECT 9;\n')

        await expect(
            runMigrations(fake.connection, {
                migrationsDirectory: directory,
                lockName: 'test-migration-lock',
            }),
        ).rejects.toThrow('Checksum mismatch for applied migration')
    })

    it('rejects applied migrations that are missing from the directory', async () => {
        const directory = await createTemporaryDirectory()
        await writeFile(join(directory, '0001_first.sql'), 'SELECT 1;\n')
        const fake = createFakeConnection({
            applied: [
                {
                    migration_id: '0009_missing.sql',
                    checksum: 'a'.repeat(64),
                },
            ],
            executedSql: [],
        })

        await expect(
            runMigrations(fake.connection, {
                migrationsDirectory: directory,
                lockName: 'test-migration-lock',
            }),
        ).rejects.toThrow('is missing from the migration directory')
    })

    it('rejects applied migrations that are out of sequence', async () => {
        const directory = await createTemporaryDirectory()
        await writeFile(join(directory, '0001_first.sql'), 'SELECT 1;\n')
        await writeFile(join(directory, '0002_second.sql'), 'SELECT 2;\n')
        const fake = createFakeConnection({
            applied: [
                {
                    migration_id: '0002_second.sql',
                    checksum: migrationChecksum('SELECT 2;\n'),
                },
            ],
            executedSql: [],
        })

        await expect(
            runMigrations(fake.connection, {
                migrationsDirectory: directory,
                lockName: 'test-migration-lock',
            }),
        ).rejects.toThrow('follows a pending migration')
    })
})

async function createTemporaryDirectory(): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), 'das7-migration-test-'))
    temporaryDirectories.push(directory)
    return directory
}

function createFakeConnection(state: FakeMigrationState): {
    connection: PoolConnection
} {
    const query = jest.fn(async (sql: string) => {
        if (sql.includes('GET_LOCK')) {
            return [[{ acquired: 1 }], []]
        }

        if (sql.includes('SELECT migration_id')) {
            return [state.applied, []]
        }

        if (sql.includes('RELEASE_LOCK')) {
            return [[{ released: 1 }], []]
        }

        state.executedSql.push(sql)
        return [[], []]
    })
    const execute = jest.fn(
        async (sql: string, values: readonly unknown[]) => {
            if (sql.includes('INSERT INTO schema_migrations')) {
                state.applied.push({
                    migration_id: String(values[0]),
                    checksum: String(values[1]),
                })
            }

            return [{}, []]
        },
    )
    const release = jest.fn()

    return {
        connection: { query, execute, release } as unknown as PoolConnection,
    }
}
