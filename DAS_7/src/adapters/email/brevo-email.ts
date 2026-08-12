import type { EmailProvider, SentEmail } from './email-provider.js';
import { EmailSendError } from './email-provider.js';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10000;

/**
 * Brevo-backed provider: one plain `fetch` per send, no SDK and no retries.
 * Any non-2xx response, network error or timeout becomes an EmailSendError.
 * The API key never appears in a thrown message.
 *
 * The `from` address must be a verified sender in the Brevo dashboard
 * (Senders & IPs -> Senders). Verifying a single address is enough; unlike
 * Resend's sandbox, recipients are then unrestricted.
 */
export function createBrevoEmailProvider(
    config: { apiKey: string; from: string; fromName?: string },
): EmailProvider {
    return {
        async send(email: SentEmail): Promise<void> {
            let response: Response;
            try {
                response = await fetch(BREVO_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'api-key': config.apiKey,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({
                        sender: { email: config.from, name: config.fromName ?? 'DAS Parent Insights' },
                        to: [{ email: email.to }],
                        subject: email.subject,
                        textContent: email.body,
                    }),
                    signal: AbortSignal.timeout(TIMEOUT_MS),
                });
            } catch (err) {
                const reason = err instanceof Error && err.name === 'TimeoutError'
                    ? `timed out after ${TIMEOUT_MS}ms`
                    : err instanceof Error ? err.message : String(err);
                throw new EmailSendError(`brevo request failed: ${reason}`);
            }

            if (!response.ok) {
                throw new EmailSendError(`brevo responded ${response.status}`);
            }
        },
    };
}
