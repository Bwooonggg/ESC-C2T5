import { z } from 'zod'
import { NOTIFICATION_FREQUENCY_VALUES } from '../../../domain/value-objects/notification-frequency.js'

const parentParamsSchema = z.object({
    parentId: z.string().trim().min(1).max(128),
})

const savePreferencesBodySchema = z.object({
    enabled: z.boolean(),
    frequency: z.enum(NOTIFICATION_FREQUENCY_VALUES),
    recipientEmail: z.string().trim().min(1).max(254),
})

export function parseParentId(params: unknown): string {
    return parentParamsSchema.parse(params).parentId
}

export function parseSavePreferencesBody(
    body: unknown,
): SavePreferencesBody {
    return savePreferencesBodySchema.parse(body)
}

export type SavePreferencesBody = z.infer<typeof savePreferencesBodySchema>
