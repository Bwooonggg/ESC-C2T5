import { z } from 'zod'

/**
 * The summary operation's own structured-output contract. It is independent
 * of the recommendation contract; neither builds on the other.
 */
export const summaryOutputSchema = z.object({
    summary: z.string().trim().min(1),
})

export type SummaryOutput = z.infer<typeof summaryOutputSchema>
