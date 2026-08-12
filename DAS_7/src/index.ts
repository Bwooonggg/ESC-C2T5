/**
 * Composition root. Every adapter, repository and service in the process is
 * built exactly once, here, and handed to `createApp` as a single `Deps` object —
 * nothing deeper in the codebase constructs its own dependencies or reads env.
 */
import 'dotenv/config';
import type { AppConfig } from './config.js';
import { loadConfig } from './config.js';
import { createApp } from './app.js';
import type { Deps } from './deps.js';
import { createDbClient } from './repos/db.js';
import { createParentRepo } from './repos/parent.repo.js';
import { createStudentRepo } from './repos/student.repo.js';
import { createProgressRepo } from './repos/progress.repo.js';
import { createSummaryRepo } from './repos/summary.repo.js';
import { createRecommendationRepo } from './repos/recommendation.repo.js';
import { createPreferenceRepo } from './repos/preference.repo.js';
import { createEmailNotificationRepo } from './repos/emailNotification.repo.js';
import type { LlmClient } from './adapters/llm/llm-client.js';
import { StubLlmClient } from './adapters/llm/stub-llm.js';
import { createOpenRouterLlmClient } from './adapters/llm/openrouter-llm.js';
import type { EmailProvider } from './adapters/email/email-provider.js';
import { FakeEmailProvider } from './adapters/email/fake-email.js';
import { createBrevoEmailProvider } from './adapters/email/brevo-email.js';
import { createInsightService } from './services/insight.service.js';
import { createPreferenceService } from './services/preference.service.js';
import { createNotifierService } from './services/notifier.service.js';
import { createScheduler } from './services/scheduler.js';

/**
 * The provider slot. Adding a real provider is one new file implementing
 * `LlmClient` plus one case here — see docs/ARCHITECTURE.md §10.1.
 */
function createLlmClient(config: AppConfig): LlmClient {
    if (config.llmProvider === 'stub') return new StubLlmClient();

    if (config.llmProvider === 'openrouter') {
        const missing = [
            config.llmApiKey === null ? 'LLM_API_KEY' : null,
            config.llmModel === null ? 'LLM_MODEL' : null,
        ].filter((key): key is string => key !== null);
        if (missing.length > 0) {
            throw new Error(
                `LLM_PROVIDER=openrouter requires ${missing.join(' and ')} to be set.`,
            );
        }
        return createOpenRouterLlmClient({
            apiKey: config.llmApiKey as string,
            model: config.llmModel as string,
            timeoutMs: config.llmTimeoutMs,
        });
    }

    throw new Error(
        `LLM provider '${config.llmProvider}' not implemented — see docs/ARCHITECTURE.md §10.1`,
    );
}

/** Brevo needs credentials; missing ones fail startup rather than the first send. */
function createEmailProvider(config: AppConfig): EmailProvider {
    if (config.emailProvider === 'brevo') {
        const missing = [
            config.brevoApiKey === null ? 'BREVO_API_KEY' : null,
            config.emailFrom === null ? 'EMAIL_FROM' : null,
        ].filter((key): key is string => key !== null);
        if (missing.length > 0) {
            throw new Error(
                `EMAIL_PROVIDER=brevo requires ${missing.join(' and ')} to be set.`,
            );
        }
        return createBrevoEmailProvider({
            apiKey: config.brevoApiKey as string,
            from: config.emailFrom as string,
        });
    }

    console.warn(
        '[email] EMAIL_PROVIDER=fake — notifications are recorded in memory, not delivered.',
    );
    return new FakeEmailProvider();
}

const config = loadConfig();
const client = createDbClient(config);

const parentRepo = createParentRepo(client);
const studentRepo = createStudentRepo(client);
const progressRepo = createProgressRepo(client);
const summaryRepo = createSummaryRepo(client);
const recommendationRepo = createRecommendationRepo(client);
const preferenceRepo = createPreferenceRepo(client);
const emailNotificationRepo = createEmailNotificationRepo(client);

const llm = createLlmClient(config);
const email = createEmailProvider(config);

const insightService = createInsightService({
    studentRepo, progressRepo, summaryRepo, recommendationRepo, llm,
});
const preferenceService = createPreferenceService({ preferenceRepo, parentRepo });
const notifierService = createNotifierService({
    preferenceRepo, parentRepo, studentRepo, emailNotificationRepo,
    insightService, email, config,
});

const deps: Deps = {
    config,
    parentRepo, studentRepo, progressRepo, summaryRepo, recommendationRepo,
    preferenceRepo, emailNotificationRepo,
    llm, email,
    insightService, preferenceService, notifierService,
};

// 0.0.0.0, not localhost: the container is reached through Traefik.
const server = createApp(deps).listen(config.port, '0.0.0.0', () => {
    console.log(
        `[das7] listening on http://0.0.0.0:${config.port}`
        + ` — schema=${config.supabaseDbSchema}, llm=${config.llmProvider},`
        + ` email=${config.emailProvider},`
        + ` scheduler=${config.schedulerEnabled ? `on (${config.schedulerTickMs}ms)` : 'off'}`,
    );
});

const scheduler = config.schedulerEnabled
    ? createScheduler((now) => deps.notifierService.runDueNotifications(now), config.schedulerTickMs)
    : null;
scheduler?.start();

/** Stop taking work, let in-flight requests finish, then leave. */
function shutdown(signal: NodeJS.Signals): void {
    console.log(`[das7] ${signal} received — shutting down.`);
    scheduler?.stop();
    server.close(() => { process.exit(0); });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
