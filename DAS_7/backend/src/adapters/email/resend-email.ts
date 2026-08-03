import type { EmailProvider, SentEmail } from './email-provider.js';
import { EmailSendError } from './email-provider.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const TIMEOUT_MS = 10000;

/**
 * Resend-backed provider: one plain `fetch` per send, no SDK and no retries.
 * Any non-2xx response, network error or timeout becomes an EmailSendError.
 * The API key never appears in a thrown message.
 */
export function createResendEmailProvider(
    config: { apiKey: string; from: string },
): EmailProvider {
    return {
        async send(email: SentEmail): Promise<void> {
            let response: Response;
            try {
                response = await fetch(RESEND_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${config.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        from: config.from,
                        to: email.to,
                        subject: email.subject,
                        text: email.body,
                    }),
                    signal: AbortSignal.timeout(TIMEOUT_MS),
                });
            } catch (err) {
                const reason = err instanceof Error && err.name === 'TimeoutError'
                    ? `timed out after ${TIMEOUT_MS}ms`
                    : err instanceof Error ? err.message : String(err);
                throw new EmailSendError(`resend request failed: ${reason}`);
            }

            if (!response.ok) {
                throw new EmailSendError(`resend responded ${response.status}`);
            }
        },
    };
}
