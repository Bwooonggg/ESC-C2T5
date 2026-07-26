import { z } from 'zod'

/**
 * The recommendation operation's own structured-output contract. It is
 * independent of the summary contract; neither builds on the other.
 */
export const recommendationOutputSchema = z.object({
    recommendation: z.string().trim().min(1),
})

export type RecommendationOutput = z.infer<typeof recommendationOutputSchema>
