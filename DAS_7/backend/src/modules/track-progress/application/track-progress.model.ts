import { randomUUID } from 'node:crypto'
import { ProgressUnavailableError } from '../../../domain/errors/progress-unavailable.error.js'
import { Summary } from '../../../domain/entities/summary.js'
import type { ProgressRecord } from '../../../domain/entities/progress-record.js'
import type { Student } from '../../../domain/entities/student.js'
import type { GeneratorInvocationContext } from '../../../shared/generator-context.js'
import { createGeneratorInvocationContext } from '../../../shared/generator-context.js'
import type { ProgressRecordRepository } from '../ports/progress-record.repository.js'
import type { StudentRepository } from '../ports/student.repository.js'
import type { SummaryGeneratorPort } from '../ports/summary-generator.js'
import type { SummaryRepository } from '../ports/summary.repository.js'

export interface TrackProgressResult {
    readonly student: Student
    readonly records: readonly ProgressRecord[]
    readonly summary: Summary
}

export interface TrackProgressModelDependencies {
    readonly studentRepository: StudentRepository
    readonly progressRecordRepository: ProgressRecordRepository
    readonly summaryRepository: SummaryRepository
    readonly summaryGenerator: SummaryGeneratorPort
    readonly now?: () => Date
    readonly createId?: () => string
    readonly maxSnapshotAttempts?: number
}

export class TrackProgressModel {
    private readonly studentRepository: StudentRepository
    private readonly progressRecordRepository: ProgressRecordRepository
    private readonly summaryRepository: SummaryRepository
    private readonly summaryGenerator: SummaryGeneratorPort
    private readonly now: () => Date
    private readonly createId: () => string
    private readonly maxSnapshotAttempts: number
    private readonly inFlight = new Map<
        string,
        Promise<TrackProgressResult>
    >()

    constructor(dependencies: TrackProgressModelDependencies) {
        const maxSnapshotAttempts = dependencies.maxSnapshotAttempts ?? 2

        if (
            !Number.isInteger(maxSnapshotAttempts) ||
            maxSnapshotAttempts < 1
        ) {
            throw new TypeError(
                'maxSnapshotAttempts must be a positive integer.',
            )
        }

        this.studentRepository = dependencies.studentRepository
        this.progressRecordRepository = dependencies.progressRecordRepository
        this.summaryRepository = dependencies.summaryRepository
        this.summaryGenerator = dependencies.summaryGenerator
        this.now = dependencies.now ?? (() => new Date())
        this.createId = dependencies.createId ?? randomUUID
        this.maxSnapshotAttempts = maxSnapshotAttempts
    }

    async trackProgress(
        studentId: string,
        context?: GeneratorInvocationContext,
    ): Promise<TrackProgressResult> {
        const student = await this.findStudent(studentId)

        if (!student) {
            throw new ProgressUnavailableError()
        }

        const key = JSON.stringify([
            student.studentId,
            student.currentProgressVersion,
        ])
        const existing = this.inFlight.get(key)

        if (existing) {
            return existing
        }

        const operation = this.generateTrackProgress(
            studentId,
            student,
            context ?? createGeneratorInvocationContext(),
        )
        this.inFlight.set(key, operation)

        try {
            return await operation
        } finally {
            if (this.inFlight.get(key) === operation) {
                this.inFlight.delete(key)
            }
        }
    }

    private async generateTrackProgress(
        studentId: string,
        initialStudent: Student,
        invocationContext: GeneratorInvocationContext,
    ): Promise<TrackProgressResult> {
        let student = initialStudent

        for (
            let attempt = 0;
            attempt < this.maxSnapshotAttempts;
            attempt += 1
        ) {
            let records: readonly ProgressRecord[]

            try {
                records = Object.freeze([
                    ...(await this.progressRecordRepository.findByStudentId(
                        studentId,
                    )),
                ])
            } catch {
                throw new ProgressUnavailableError()
            }

            if (
                records.length === 0 ||
                !recordsBelongToStudent(records, studentId)
            ) {
                throw new ProgressUnavailableError()
            }

            const generated = await this.summaryGenerator.generate(
                { student, records },
                invocationContext,
            )

            const currentStudent = await this.findStudent(studentId)

            if (!currentStudent) {
                throw new ProgressUnavailableError()
            }

            if (
                currentStudent.currentProgressVersion !==
                student.currentProgressVersion
            ) {
                student = currentStudent
                continue
            }

            const summary = new Summary({
                summaryId: this.createId(),
                studentId,
                content: generated.content,
                generatedAt: this.now(),
                sourceProgressVersion: currentStudent.currentProgressVersion,
            })

            await this.summaryRepository.save(summary)

            return {
                student: currentStudent,
                records,
                summary,
            }
        }

        throw new ProgressUnavailableError(
            'Progress changed while the summary was being generated.',
        )
    }

    private async findStudent(studentId: string): Promise<Student | null> {
        try {
            const student = await this.studentRepository.findById(studentId)
            return student && student.studentId === studentId ? student : null
        } catch {
            throw new ProgressUnavailableError()
        }
    }
}

function recordsBelongToStudent(
    records: readonly ProgressRecord[],
    studentId: string,
): boolean {
    return records.every((record) => record.studentId === studentId)
}
