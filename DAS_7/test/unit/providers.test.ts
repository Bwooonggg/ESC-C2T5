// @ts-nocheck -- global fetch replacement is intentionally a runtime test double.
import { createOpenRouterLlmClient } from '../../src/adapters/llm/openrouter-llm.js';
import { jest } from '@jest/globals';
import { createBrevoEmailProvider } from '../../src/adapters/email/brevo-email.js';
import { record, response, student, summary } from './helpers.js';

const routerConfig = { apiKey: 'router-secret', model: 'model', timeoutMs: 1 };
const email = { to: 'parent@example.com', subject: 'Subject', body: 'Body' };

describe('OpenRouterLlmClient', () => {
    const originalFetch = global.fetch;
    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });
    function fetchText(content: string) {
        global.fetch = jest.fn().mockResolvedValue(response(content));
    }
    it.each([
        [
            'UT-DAS7-U07-03',
            [
                record,
                { ...record, recordId: 'r2', notes: 'two' },
                { ...record, recordId: 'r3', notes: 'three' },
            ],
        ],
    ])('%s formats progress rows in prompt', async (_id, records) => {
        fetchText('summary');

        await expect(
            createOpenRouterLlmClient(routerConfig).generateSummary({ student, records }),
        ).resolves.toBe('summary');

        const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
        const user = body.messages[1].content;
        expect(user).toContain('Assessment records');
        records.forEach((r) => expect(user).toContain(r.notes));
    });
    it('UT-DAS7-U07-11 network failure is normalised without key', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('offline'));

        await expect(
            createOpenRouterLlmClient(routerConfig).generateSummary({ student, records: [] }),
        ).rejects.toThrow('offline');

        try {
            await createOpenRouterLlmClient(routerConfig).generateSummary({ student, records: [] });
        } catch (e) {
            expect(String(e)).not.toContain('router-secret');
        }
    });
    it('UT-DAS7-U10-01 recommendation includes student and summary', async () => {
        fetchText('One\nTwo\nThree');

        await expect(
            createOpenRouterLlmClient(routerConfig).generateRecommendation({ student, summary }),
        ).resolves.toBe('One\nTwo\nThree');

        const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
        expect(body.messages[1].content).toContain('Amy');
        expect(body.messages[1].content).toContain(summary.content);
    });
});

describe('BrevoEmailProvider', () => {
    const originalFetch = global.fetch;
    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });
    it.each([['UT-DAS7-U26-01', undefined, 'DAS Parent Insights']])(
        '%s sends requested sender name',
        async (_id, fromName, expected) => {
            global.fetch = jest.fn().mockResolvedValue(response('', 202));

            await expect(
                createBrevoEmailProvider({
                    apiKey: 'brevo-secret',
                    from: 'noreply@example.com',
                    fromName,
                }).send(email),
            ).resolves.toBeUndefined();

            const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
            expect(body.sender.name).toBe(expected);
        },
    );
    it('UT-DAS7-U26-05 non-2xx is email send error', async () => {
        global.fetch = jest.fn().mockResolvedValue(response('', 400));

        await expect(
            createBrevoEmailProvider({ apiKey: 'brevo-secret', from: 'noreply@example.com' }).send(email),
        ).rejects.toEqual(expect.objectContaining({ message: 'brevo responded 400' }));
    });
});
