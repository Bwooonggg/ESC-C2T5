import type { EmailProvider, SentEmail } from './email-provider.js';
import { EmailSendError } from './email-provider.js';

/**
 * Offline email provider for tests and local development.
 * `history` is append-only and holds successfully sent emails, in order.
 */
export class FakeEmailProvider implements EmailProvider {
    readonly history: SentEmail[] = [];
    mode: 'ok' | 'fail' = 'ok';

    async send(email: SentEmail): Promise<void> {
        if (this.mode === 'fail') throw new EmailSendError('fake provider unreachable');
        this.history.push(email);
    }
}
