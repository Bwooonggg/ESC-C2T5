// @ts-nocheck -- global fetch replacement is intentionally a runtime test double.
import { createOpenRouterLlmClient } from '../../src/adapters/llm/openrouter-llm.js';
import { jest } from '@jest/globals';
import { createBrevoEmailProvider } from '../../src/adapters/email/brevo-email.js';
import { LlmUnavailableError } from '../../src/adapters/llm/llm-client.js';
import { EmailSendError } from '../../src/adapters/email/email-provider.js';
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
    it.each([['UT-DAS7-U07-01', []], ['UT-DAS7-U07-02', [record]], ['UT-DAS7-U07-03', [record, { ...record, recordId: 'r2', notes: 'two' }, { ...record, recordId: 'r3', notes: 'three' }]]])('%s formats progress rows in prompt', async (_id, records) => { fetchText('summary'); await expect(createOpenRouterLlmClient(routerConfig).generateSummary({ student, records })).resolves.toBe('summary'); const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body); const user = body.messages[1].content; expect(user).toContain('Assessment records'); records.forEach(r => expect(user).toContain(r.notes)); });
    it('UT-DAS7-U07-04 empty summary is unavailable', async () => {
        fetchText('   ');
        await expect(createOpenRouterLlmClient(routerConfig).generateSummary({ student, records: [] })).rejects.toBeInstanceOf(LlmUnavailableError);
    });
    it.each([['UT-DAS7-U07-05', 1], ['UT-DAS7-U07-06', 2], ['UT-DAS7-U07-07', 1000], ['UT-DAS7-U07-08', 1999], ['UT-DAS7-U07-09', 2000], ['UT-DAS7-U07-10', 2001]])('%s caps summary length', async (_id, n) => { fetchText('x'.repeat(n)); const text = await createOpenRouterLlmClient(routerConfig).generateSummary({ student, records: [] }); expect(text).toHaveLength(Math.min(n, 2000)); });
    it('UT-DAS7-U07-11 network failure is normalised without key', async () => { global.fetch = jest.fn().mockRejectedValue(new Error('offline')); await expect(createOpenRouterLlmClient(routerConfig).generateSummary({ student, records: [] })).rejects.toThrow('offline'); try { await createOpenRouterLlmClient(routerConfig).generateSummary({ student, records: [] }); } catch (e) { expect(String(e)).not.toContain('router-secret'); } });
    it('UT-DAS7-U07-12 non-2xx excludes key', async () => {
        global.fetch = jest.fn().mockResolvedValue(response('', 429));
        await expect(createOpenRouterLlmClient(routerConfig).generateSummary({ student, records: [] })).rejects.toThrow('429');
    });
    it('UT-DAS7-U07-13 malformed JSON becomes unavailable', async () => { global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: jest.fn().mockRejectedValue(new SyntaxError()) }); await expect(createOpenRouterLlmClient(routerConfig).generateSummary({ student, records: [] })).rejects.toBeInstanceOf(LlmUnavailableError); });
    it('UT-DAS7-U07-14 provider error object becomes unavailable', async () => { global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: jest.fn().mockResolvedValue({ error: { message: 'busy' } }) }); await expect(createOpenRouterLlmClient(routerConfig).generateSummary({ student, records: [] })).rejects.toThrow('busy'); });
    it('UT-DAS7-U10-01 recommendation includes student and summary', async () => { fetchText('One\nTwo\nThree'); await expect(createOpenRouterLlmClient(routerConfig).generateRecommendation({ student, summary })).resolves.toBe('One\nTwo\nThree'); const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body); expect(body.messages[1].content).toContain('Amy'); expect(body.messages[1].content).toContain(summary.content); });
    it.each([['UT-DAS7-U10-02', '- Read together'], ['UT-DAS7-U10-03', '1) Read together'], ['UT-DAS7-U10-04', '\n\nRead together\n\n']])('%s sanitises representative markers and blanks', async (_id, raw) => { fetchText(raw); await expect(createOpenRouterLlmClient(routerConfig).generateRecommendation({ student, summary })).resolves.toBe('Read together'); });
    it('UT-DAS7-U10-05 no sanitized lines fails', async () => { fetchText('-'); await expect(createOpenRouterLlmClient(routerConfig).generateRecommendation({ student, summary })).rejects.toThrow('no advice lines'); });
    it.each([['UT-DAS7-U10-06', 1], ['UT-DAS7-U10-07', 2], ['UT-DAS7-U10-08', 3], ['UT-DAS7-U10-09', 4], ['UT-DAS7-U10-10', 5], ['UT-DAS7-U10-11', 6]])('%s caps recommendation lines', async (_id, count) => { fetchText(Array.from({ length: count }, (_, i) => `line${i + 1}`).join('\n')); const result = await createOpenRouterLlmClient(routerConfig).generateRecommendation({ student, summary }); expect(result.split('\n')).toHaveLength(Math.min(count, 5)); });
});

describe('BrevoEmailProvider', () => {
    const originalFetch = global.fetch;
    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });
    it.each([['UT-DAS7-U26-01', undefined, 'DAS Parent Insights'], ['UT-DAS7-U26-02', 'DAS Team', 'DAS Team']])('%s sends requested sender name', async (_id, fromName, expected) => { global.fetch = jest.fn().mockResolvedValue(response('', 202)); await expect(createBrevoEmailProvider({ apiKey: 'brevo-secret', from: 'noreply@example.com', fromName }).send(email)).resolves.toBeUndefined(); const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body); expect(body.sender.name).toBe(expected); });
    it.each([['UT-DAS7-U26-03', new Error('offline'), 'offline'], ['UT-DAS7-U26-04', Object.assign(new Error('late'), { name: 'TimeoutError' }), 'timed out']])('%s normalises send rejection without secret', async (_id, rejection, message) => { global.fetch = jest.fn().mockRejectedValue(rejection); await expect(createBrevoEmailProvider({ apiKey: 'brevo-secret', from: 'noreply@example.com' }).send(email)).rejects.toThrow(message); try { await createBrevoEmailProvider({ apiKey: 'brevo-secret', from: 'noreply@example.com' }).send(email); } catch (e) { expect(String(e)).not.toContain('brevo-secret'); } });
    it('UT-DAS7-U26-05 non-2xx is email send error', async () => { global.fetch = jest.fn().mockResolvedValue(response('', 400)); await expect(createBrevoEmailProvider({ apiKey: 'brevo-secret', from: 'noreply@example.com' }).send(email)).rejects.toEqual(expect.objectContaining({ message: 'brevo responded 400' })); });
});
