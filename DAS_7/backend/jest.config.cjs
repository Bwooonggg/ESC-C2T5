/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
    transform: { '^.+\\.ts$': ['ts-jest', { useESM: true }] },
    setupFiles: ['dotenv/config'],
};
