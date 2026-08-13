import type { Deps, PreferenceService } from '../deps.js';
import { NotFoundError, ValidationError } from '../errors.js';
import type { NotificationFrequency, NotificationPreference } from '../types.js';
import { NOTIFICATION_FREQUENCIES } from '../types.js';

// ^[^\s@]+ start of line with non-empty string (without '@')
// @ literal '@' character (part of email)
// \. literal '.' character
// [^\s@]+$ non-empty string (without '@') up to end of line
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Hand-rolled validation of the API's only request body; first failure wins. */
function validate(body: unknown): Omit<NotificationPreference, 'parentId'> {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        throw new ValidationError('Request body must be an object.');
    }

    const raw = body as Record<string, unknown>;

    if (raw.enabled !== true && raw.enabled !== false) {
        throw new ValidationError('`enabled` must be true or false.');
    }

    if (!NOTIFICATION_FREQUENCIES.includes(raw.frequency as NotificationFrequency)) {
        throw new ValidationError(
            '`frequency` must be one of: Weekly, Fortnightly, Monthly.',
        );
    }

    // Normalised first so that surrounding whitespace is forgiven rather than
    // rejected by the pattern's `[^\s@]` anchors.
    const recipientEmail =
        typeof raw.recipientEmail === 'string' ? raw.recipientEmail.trim().toLowerCase() : '';
    if (!EMAIL_PATTERN.test(recipientEmail)) {
        throw new ValidationError('`recipientEmail` must be a valid email address.');
    }

    return {
        enabled: raw.enabled,
        frequency: raw.frequency as NotificationFrequency,
        recipientEmail,
    };
}

export function createPreferenceService(
    deps: Pick<Deps, 'preferenceRepo' | 'parentRepo'>,
): PreferenceService {
    const { preferenceRepo, parentRepo } = deps;

    return {
        async get(parentId) {
            const pref = await preferenceRepo.byParentId(parentId);
            if (pref) return pref;

            // No row yet: hand back a non-persisted default addressed to the
            // parent's account email. Routes already checked ownership, so a
            // missing parent here means the row vanished mid-request.
            const parent = await parentRepo.byId(parentId);
            if (!parent) throw new NotFoundError();

            return {
                parentId,
                enabled: false,
                frequency: 'Weekly',
                recipientEmail: parent.email,
            };
        },

        async save(parentId, body) {
            const fields = validate(body);
            // parentId always comes from the URL, never from the body.
            return preferenceRepo.upsert({ parentId, ...fields });
        },
    };
}
