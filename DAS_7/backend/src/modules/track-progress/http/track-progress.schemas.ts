import { z } from 'zod'

const studentParamsSchema = z.object({
    studentId: z.string().trim().min(1).max(128),
})

export function parseStudentId(params: unknown): string {
    return studentParamsSchema.parse(params).studentId
}
