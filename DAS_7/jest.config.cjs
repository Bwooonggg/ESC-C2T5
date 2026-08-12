/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    testPathIgnorePatterns: ['/OLDTEST_'],
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
    transform: { '^.+\\.ts$': ['ts-jest', { useESM: true }] },
    setupFiles: ['dotenv/config'],
    // Integration suites share one live Supabase project and one pair of test auth
    // users; `insight.parents.auth_user_id` is UNIQUE, so two harnesses can never
    // exist at the same time. Serial execution is what makes them safe to run.
    maxWorkers: 1,
    // Those suites talk to Supabase over the network — the 5s default is a timeout
    // on latency, not on a real failure.
    testTimeout: 60000,
};
