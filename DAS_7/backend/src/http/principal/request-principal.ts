import type { VerifiedAccessTokenClaims } from './verified-access-token-claims.js'

export interface RequestPrincipalProps {
    readonly subject: string
    readonly sessionId?: string | null
    readonly role?: string | null
    readonly requestId: string
}

/**
 * Immutable identity context attached to a verified API request.
 *
 * This class is a transport boundary type, not an authentication service. It
 * contains only trusted values supplied by the platform verifier and a DAS7
 * correlation identifier.
 */
export class RequestPrincipal {
    readonly subject: string
    readonly sessionId: string | null
    readonly role: string | null
    readonly requestId: string

    constructor(props: RequestPrincipalProps) {
        this.subject = requireNonEmptyText(props.subject, 'subject')
        this.sessionId = normalizeOptionalText(props.sessionId, 'sessionId')
        this.role = normalizeOptionalText(props.role, 'role')
        this.requestId = requireNonEmptyText(props.requestId, 'requestId')

        Object.freeze(this)
    }
}

export function createRequestPrincipal(
    claims: VerifiedAccessTokenClaims,
    requestId: string,
): RequestPrincipal {
    return new RequestPrincipal({
        subject: claims.subject,
        sessionId: claims.sessionId,
        role: claims.role,
        requestId,
    })
}

function requireNonEmptyText(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new PrincipalValidationError(
            `${field} must be a non-empty string.`,
        )
    }

    return value.trim()
}

function normalizeOptionalText(
    value: string | null | undefined,
    field: string,
): string | null {
    if (value === undefined || value === null) {
        return null
    }

    return requireNonEmptyText(value, field)
}

export class PrincipalValidationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'PrincipalValidationError'
    }
}
