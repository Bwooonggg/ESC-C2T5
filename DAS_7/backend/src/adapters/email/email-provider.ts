export interface SentEmail {
    to: string;
    subject: string;
    body: string;
}

export class EmailSendError extends Error {
    constructor(message = 'email send failed') { super(message); this.name = 'EmailSendError'; }
}

export interface EmailProvider {
    /** Resolves on success; throws EmailSendError on any failure. */
    send(email: SentEmail): Promise<void>;
}
