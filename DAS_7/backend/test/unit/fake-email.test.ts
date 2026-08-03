import { EmailSendError } from '../../src/adapters/email/email-provider.js';
import { FakeEmailProvider } from '../../src/adapters/email/fake-email.js';

describe('FakeEmailProvider', () => {
    it('starts empty and in "ok" mode', () => {
        const provider = new FakeEmailProvider();

        expect(provider.history).toEqual([]);
        expect(provider.mode).toBe('ok');
    });

    it('appends successfully sent emails to history, in order', async () => {
        const provider = new FakeEmailProvider();

        await provider.send({ to: 'a@test.dev', subject: 'first', body: 'one' });
        await provider.send({ to: 'b@test.dev', subject: 'second', body: 'two' });

        expect(provider.history).toEqual([
            { to: 'a@test.dev', subject: 'first', body: 'one' },
            { to: 'b@test.dev', subject: 'second', body: 'two' },
        ]);
    });

    it('throws EmailSendError and appends nothing when mode is "fail"', async () => {
        const provider = new FakeEmailProvider();
        provider.mode = 'fail';

        await expect(provider.send({ to: 'a@test.dev', subject: 's', body: 'b' }))
            .rejects.toBeInstanceOf(EmailSendError);
        expect(provider.history).toHaveLength(0);
    });

    it('resumes sending once mode is flipped back to "ok"', async () => {
        const provider = new FakeEmailProvider();
        provider.mode = 'fail';
        await expect(provider.send({ to: 'a@test.dev', subject: 's', body: 'b' })).rejects.toThrow();

        provider.mode = 'ok';
        await provider.send({ to: 'a@test.dev', subject: 's', body: 'b' });

        expect(provider.history).toHaveLength(1);
    });
});
