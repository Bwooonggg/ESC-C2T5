/**
 * The small, normalized claim set that DAS7 needs after a platform token has
 * been verified. This deliberately contains no Supabase SDK/Auth types.
 */
export interface VerifiedAccessTokenClaims {
    readonly subject: string
    readonly sessionId?: string | null
    readonly role?: string | null
}
