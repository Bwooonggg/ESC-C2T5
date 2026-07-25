import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { config as loadDotEnv } from 'dotenv'
import {
    afterAll,
    beforeAll,
    describe,
    expect,
    jest,
    test,
} from '@jest/globals'
import request from 'supertest'
import type { Express } from 'express'
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise'
import { createApiContainer } from '../../../src/app/api-container.js'
import { createApiApp } from '../../../src/app/create-api-app.js'
import { loadConfig } from '../../../src/config/environment.js'
import { ProgressRecord } from '../../../src/domain/entities/progress-record.js'
import { Student } from '../../../src/domain/entities/student.js'
import { SkillArea } from '../../../src/domain/value-objects/skill-area.js'
import { TrackProgressModel } from '../../../src/modules/track-progress/application/track-progress.model.js'
import { RecommendationModel } from '../../../src/modules/track-progress/application/recommendation.model.js'
import type { RecommendationGeneratorPort } from '../../../src/modules/track-progress/ports/recommendation-generator.js'
import type { SummaryGeneratorPort } from '../../../src/modules/summaries/ports/summary-generator.js'
import { createMySqlPool } from '../../../src/infrastructure/mysql/pool.js'
import {
    discoverMigrationFiles,
    getMigrationLockName,
    runMigrations,
} from '../../../src/infrastructure/mysql/migration-runner.js'
import {
    MySqlProgressRecordRepository,
    MySqlRecommendationRepository,
    MySqlStudentRepository,
    MySqlSummaryRepository,
} from '../../../src/infrastructure/mysql/repositories/index.js'

interface IntegrationDatabaseConfig {
    readonly host: string
    readonly port: number
    readonly database: string
    readonly user: string
    readonly password: string
}

const integrationEnvironmentFile = resolve(
    __dirname,
    '../../../.env.integration',
)
const migrationsDirectory = resolve(__dirname, '../../../db/migrations')

loadDotEnv({ path: integrationEnvironmentFile, quiet: true })

let pool: Pool | undefined
let migrationConnection: PoolConnection | undefined
let app: Express
let studentId: string
let recordId: string

describe('Track Progress and Recommendation API end-to-end', () => {
    beforeAll(async () => {
        const config = readIntegrationDatabaseConfig()
        pool = createMySqlPool(config, {
            connectionLimit: 3,
            multipleStatements: true,
        })
        migrationConnection = await pool.getConnection()

        await runMigrations(migrationConnection, {
            migrationsDirectory,
            lockName: getMigrationLockName(config.database),
        })

        migrationConnection.release()
        migrationConnection = undefined

        studentId = `e2e-student-${randomUUID()}`
        recordId = `e2e-record-${randomUUID()}`

        const studentRepository = new MySqlStudentRepository(pool)
        const progressRecordRepository = new MySqlProgressRecordRepository(
            pool,
        )
        const summaryRepository = new MySqlSummaryRepository(pool)
        const recommendationRepository = new MySqlRecommendationRepository(
            pool,
        )
        const student = new Student({
            studentId,
            name: 'E2E Student',
            dateOfBirth: new Date('2015-06-15T00:00:00.000Z'),
            bandLevel: 'Band 2',
            currentProgressVersion: 'v0',
        })
        const record = new ProgressRecord({
            recordId,
            studentId,
            date: new Date('2026-07-23T00:00:00.000Z'),
            skillArea: new SkillArea('Reading Fluency'),
            score: 82.5,
            notes: 'Database-backed end-to-end fixture.',
        })
        const summaryGenerator: SummaryGeneratorPort = {
            async generate({ student: requestedStudent, records }) {
                return {
                    content: `Generated summary for ${requestedStudent.studentId} from ${records.length} record.`,
                }
            },
        }
        const recommendationGenerator: RecommendationGeneratorPort = {
            async generate({ summary }) {
                return {
                    content: `Generated recommendation for ${summary.studentId}.`,
                }
            },
        }

        await studentRepository.save(student)
        await progressRecordRepository.save(record)

        const model = new TrackProgressModel({
            studentRepository,
            progressRecordRepository,
            summaryRepository,
            summaryGenerator,
            now: () => new Date('2026-07-23T12:00:00.000Z'),
            createId: () => `e2e-summary-${randomUUID()}`,
        })
        const recommendationModel = new RecommendationModel({
            summaryRepository,
            recommendationRepository,
            recommendationGenerator,
            now: () => new Date('2026-07-23T12:30:00.000Z'),
            createId: () => `e2e-recommendation-${randomUUID()}`,
        })

        app = createApiApp(
            createApiContainer(loadConfig({ NODE_ENV: 'test' }), {
                trackProgressModel: model,
                recommendationModel,
            }),
        )
    })

    afterAll(async () => {
        migrationConnection?.release()

        if (pool) {
            if (!studentId || !recordId) {
                await pool.end()
                return
            }

            const cleanupConnection = await pool.getConnection()

            try {
                await cleanupConnection.execute(
                    'DELETE FROM recommendations WHERE student_id = ?',
                    [studentId],
                )
                await cleanupConnection.execute(
                    'DELETE FROM summaries WHERE student_id = ?',
                    [studentId],
                )
                await cleanupConnection.execute(
                    'DELETE FROM progress_records WHERE record_id = ?',
                    [recordId],
                )
                await cleanupConnection.execute(
                    'DELETE FROM students WHERE student_id = ?',
                    [studentId],
                )
            } finally {
                cleanupConnection.release()
            }

            await pool.end()
        }
    })

    test('serves progress, generates a summary, and persists it', async () => {
        const response = await request(app).get(
            `/api/students/${studentId}/track-progress`,
        )

        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({
            ok: true,
            data: {
                progress: [
                    {
                        recordId,
                        studentId,
                        date: '2026-07-23',
                        skillArea: 'Reading Fluency',
                        score: 82.5,
                    },
                ],
                summary: {
                    studentId,
                    content: `Generated summary for ${studentId} from 1 record.`,
                    generatedAt: '2026-07-23T12:00:00.000Z',
                },
            },
        })

        const [rows] = await pool!.query<SummaryContentRow[]>(
            `
                SELECT content
                FROM summaries
                WHERE student_id = ?
                ORDER BY generated_at DESC, summary_id DESC
                LIMIT 1
            `,
            [studentId],
        )

        expect(rows).toEqual([
            {
                content: `Generated summary for ${studentId} from 1 record.`,
            },
        ])
    })

    test('returns progressUnavailable when the student cannot be found', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined)
        const response = await request(app).get(
            `/api/students/missing-${randomUUID()}/track-progress`,
        )

        expect(response.status).toBe(503)
        expect(response.body).toEqual({
            ok: false,
            error: 'progressUnavailable',
        })
    })

    test('generates a recommendation from the persisted latest summary', async () => {
        const response = await request(app).post(
            `/api/students/${studentId}/recommendations`,
        )

        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({
            ok: true,
            data: {
                recommendationId: expect.any(String),
                summaryId: expect.any(String),
                content: `Generated recommendation for ${studentId}.`,
                generatedAt: '2026-07-23T12:30:00.000Z',
            },
        })

        const [rows] = await pool!.query<RecommendationContentRow[]>(
            `
                SELECT summary_id, content
                FROM recommendations
                WHERE student_id = ?
                ORDER BY generated_at DESC, recommendation_id DESC
                LIMIT 1
            `,
            [studentId],
        )

        expect(rows).toEqual([
            {
                summary_id: response.body.data.summaryId,
                content: `Generated recommendation for ${studentId}.`,
            },
        ])
    })

    test('returns summaryUnavailable when no summary exists', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined)
        const response = await request(app).post(
            `/api/students/missing-${randomUUID()}/recommendations`,
        )

        expect(response.status).toBe(404)
        expect(response.body).toEqual({
            ok: false,
            error: 'summaryUnavailable',
        })
    })
})

function readIntegrationDatabaseConfig(): IntegrationDatabaseConfig {
    const requiredKeys = [
        'MYSQL_TEST_HOST',
        'MYSQL_TEST_PORT',
        'MYSQL_TEST_DATABASE',
        'MYSQL_TEST_USER',
        'MYSQL_TEST_PASSWORD',
    ] as const
    const missingKeys = requiredKeys.filter(
        (key) => process.env[key] === undefined,
    )

    if (missingKeys.length > 0) {
        throw new Error(
            `MySQL integration tests require ${missingKeys.join(
                ', ',
            )}. Copy .env.integration.example and export its values before running npm run test:integration.`,
        )
    }

    const database = process.env.MYSQL_TEST_DATABASE!.trim()

    if (!/(^|[_-])test([_-]|$)/i.test(database)) {
        throw new Error(
            'MYSQL_TEST_DATABASE must identify a dedicated test database (for example, das7_integration_test).',
        )
    }

    const port = Number(process.env.MYSQL_TEST_PORT)

    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error('MYSQL_TEST_PORT must be an integer between 1 and 65535.')
    }

    return {
        host: process.env.MYSQL_TEST_HOST!.trim(),
        port,
        database,
        user: process.env.MYSQL_TEST_USER!.trim(),
        password: process.env.MYSQL_TEST_PASSWORD!,
    }
}

interface SummaryContentRow extends RowDataPacket {
    readonly content: string
}

interface RecommendationContentRow extends RowDataPacket {
    readonly summary_id: string
    readonly content: string
}
