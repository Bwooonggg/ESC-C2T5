import express, { type RequestHandler } from 'express';
import type { Deps, ParentRepo, PreferenceRepo } from '../src/deps.js';
import type { NotificationPreference, Parent } from '../src/types.js';
import { errorHandler } from '../src/http/error-handler.js';
import { preferencesRoutes } from '../src/http/routes/preferences.routes.js';
import { createPreferenceService } from '../src/services/preference.service.js';

const host = '127.0.0.1';
const port = Number.parseInt(process.env.FUZZ_HARNESS_PORT ?? '4107', 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('FUZZ_HARNESS_PORT must be a valid TCP port');
}

const parent: Parent = {
    parentId: 'fuzz-parent',
    name: 'Fuzz Parent',
    email: 'baseline@example.test',
    mobileNumber: '00000000',
    studentIds: [],
};
const baseline: NotificationPreference = {
    parentId: parent.parentId,
    enabled: false,
    frequency: 'Weekly',
    recipientEmail: parent.email,
};

let stored: NotificationPreference = { ...baseline };
let writes = 0;

const preferenceRepo: PreferenceRepo = {
    async byParentId(parentId) {
        return parentId === parent.parentId ? { ...stored } : null;
    },
    async upsert(preference) {
        writes += 1;
        stored = { ...preference };
        return { ...stored };
    },
    async listEnabled() {
        return stored.enabled ? [{ ...stored }] : [];
    },
};
const parentRepo: ParentRepo = {
    async byAuthUserId() { return parent; },
    async byId(parentId) { return parentId === parent.parentId ? parent : null; },
};
const preferenceService = createPreferenceService({ preferenceRepo, parentRepo });

const attachFuzzParent: RequestHandler = (req, _res, next) => {
    req.parent = parent;
    next();
};

const app = express();
app.use(express.json({ limit: '100kb', strict: true }));

app.get('/__fuzz/health', (_req, res) => {
    res.json({ ok: true });
});
app.get('/__fuzz/state', (_req, res) => {
    res.json({ writes, preference: stored });
});
app.post('/__fuzz/reset', (_req, res) => {
    writes = 0;
    stored = { ...baseline };
    res.json({ ok: true });
});

app.use(attachFuzzParent);
app.use('/parents', preferencesRoutes({ preferenceService } as Deps));
app.use(errorHandler);

const server = app.listen(port, host, () => {
    process.stdout.write(`[fuzz-harness] listening on http://${host}:${port}\n`);
});

function stop(): void {
    server.close(() => process.exit(0));
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
