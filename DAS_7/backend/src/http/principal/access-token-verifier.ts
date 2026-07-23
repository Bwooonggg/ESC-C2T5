import type { VerifiedAccessTokenClaims } from './verified-access-token-claims.js'

/**
 * Integration seam for the platform's token verifier. R4 defines the
 * boundary; the Supabase-backed implementation is intentionally deferred to
 * R6 and no login, signup, or token-issuing behavior belongs here.
 */
export interface AccessTokenVerifier {
    verify(accessToken: string): Promise<VerifiedAccessTokenClaims>
}
