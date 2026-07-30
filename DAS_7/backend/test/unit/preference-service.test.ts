import type { ParentRepo, PreferenceRepo } from '../../src/deps.js';
import { ValidationError } from '../../src/errors.js';
import type { NotificationPreference, Parent } from '../../src/types.js';
import { createPreferenceService } from '../../src/services/preference.service.js';

const PARENT_A: Parent = {
    parentId: 'parent-a',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    mobileNumber: '+6580000001',
    studentIds: ['student-a1'],
};

interface FakePreferenceRepo extends PreferenceRepo {
    upsertCalls: NotificationPreference[];
}

function fakePreferenceRepo(seed: NotificationPreference[] = []): FakePreferenceRepo {
    const rows = new Map<string, NotificationPreference>(
        seed.map((pref) => [pref.parentId, pref]),
    );
    const upsertCalls: NotificationPreference[] = [];

    return {
        upsertCalls,
        async byParentId(parentId) {
            return rows.get(parentId) ?? null;
        },
        async upsert(pref) {
            upsertCalls.push(pref);
            rows.set(pref.parentId, pref);
            return pref;
        },
        async listEnabled() {
            return [...rows.values()].filter((pref) => pref.enabled);
        },
    };
}

function fakeParentRepo(parents: Parent[] = [PARENT_A]): ParentRepo {
    return {
        async byId(parentId) {
            return parents.find((p) => p.parentId === parentId) ?? null;
        },
        async byAuthUserId() {
            return null;
        },
    };
}

function makeService(preferenceRepo: FakePreferenceRepo, parentRepo = fakeParentRepo()) {
    return createPreferenceService({ preferenceRepo, parentRepo });
}

describe('createPreferenceService.get', () => {
    it('returns the stored preference when one exists', async () => {
        const stored: NotificationPreference = {
            parentId: PARENT_A.parentId,
            enabled: true,
            frequency: 'Monthly',
            recipientEmail: 'stored@example.com',
        };
        const preferenceRepo = fakePreferenceRepo([stored]);

        await expect(makeService(preferenceRepo).get(PARENT_A.parentId)).resolves.toEqual(stored);
    });

    it('returns a non-persisted default when no row exists', async () => {
        const preferenceRepo = fakePreferenceRepo();

        const pref = await makeService(preferenceRepo).get(PARENT_A.parentId);

        expect(pref).toEqual({
            parentId: PARENT_A.parentId,
            enabled: false,
            frequency: 'Weekly',
            recipientEmail: PARENT_A.email,
        });
        expect(preferenceRepo.upsertCalls).toHaveLength(0);
        await expect(preferenceRepo.byParentId(PARENT_A.parentId)).resolves.toBeNull();
    });

    it('throws 404 when neither a preference nor the parent exists', async () => {
        const service = makeService(fakePreferenceRepo(), fakeParentRepo([]));

        await expect(service.get(PARENT_A.parentId)).rejects.toMatchObject({
            status: 404,
            message: 'notFound',
        });
    });
});

describe('createPreferenceService.save', () => {
    it('upserts and returns a valid body, taking parentId from the argument', async () => {
        const preferenceRepo = fakePreferenceRepo();

        const saved = await makeService(preferenceRepo).save(PARENT_A.parentId, {
            parentId: 'someone-else',
            enabled: true,
            frequency: 'Fortnightly',
            recipientEmail: 'a@test.dev',
            extra: 'ignored',
        });

        const expected: NotificationPreference = {
            parentId: PARENT_A.parentId,
            enabled: true,
            frequency: 'Fortnightly',
            recipientEmail: 'a@test.dev',
        };
        expect(saved).toEqual(expected);
        expect(preferenceRepo.upsertCalls).toEqual([expected]);
    });

    it('normalises the recipient email before saving', async () => {
        const preferenceRepo = fakePreferenceRepo();

        const saved = await makeService(preferenceRepo).save(PARENT_A.parentId, {
            enabled: false,
            frequency: 'Weekly',
            recipientEmail: '  Parent@X.COM ',
        });

        expect(saved.recipientEmail).toBe('parent@x.com');
        expect(preferenceRepo.upsertCalls[0]!.recipientEmail).toBe('parent@x.com');
    });

    const valid = { enabled: true, frequency: 'Weekly', recipientEmail: 'a@test.dev' };

    const invalidCases: Array<{ name: string; body: unknown; message: string }> = [
        { name: 'null body', body: null, message: 'Request body must be an object.' },
        { name: 'array body', body: [], message: 'Request body must be an object.' },
        { name: 'string body', body: 'str', message: 'Request body must be an object.' },
        { name: 'non-boolean enabled', body: { ...valid, enabled: 'yes' }, message: '`enabled` must be true or false.' },
        { name: 'missing enabled', body: { frequency: 'Weekly', recipientEmail: 'a@test.dev' }, message: '`enabled` must be true or false.' },
        { name: 'unknown frequency', body: { ...valid, frequency: 'Daily' }, message: '`frequency` must be one of: Weekly, Fortnightly, Monthly.' },
        { name: 'malformed recipientEmail', body: { ...valid, recipientEmail: 'not-an-email' }, message: '`recipientEmail` must be a valid email address.' },
        { name: 'numeric recipientEmail', body: { ...valid, recipientEmail: 42 }, message: '`recipientEmail` must be a valid email address.' },
    ];

    it.each(invalidCases)('rejects $name with its exact message', async ({ body, message }) => {
        const preferenceRepo = fakePreferenceRepo();

        await expect(makeService(preferenceRepo).save(PARENT_A.parentId, body))
            .rejects.toThrow(new ValidationError(message));
        await expect(makeService(preferenceRepo).save(PARENT_A.parentId, body))
            .rejects.toMatchObject({ status: 400 });
        expect(preferenceRepo.upsertCalls).toHaveLength(0);
    });

    it('reports the enabled failure first when every field is invalid', async () => {
        const preferenceRepo = fakePreferenceRepo();

        await expect(makeService(preferenceRepo).save(PARENT_A.parentId, {
            enabled: 'yes',
            frequency: 'Daily',
            recipientEmail: 'not-an-email',
        })).rejects.toThrow(new ValidationError('`enabled` must be true or false.'));
    });
});
