/** @type {import('jest').Config} */
module.exports = {
    roots: ['<rootDir>/test'],
    testEnvironment: 'node',
    clearMocks: true,
    restoreMocks: true,
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/entrypoints/**/*.ts',
    ],
    testPathIgnorePatterns: ['<rootDir>/test/integration/'],
    coverageProvider: 'v8',
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
    },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
}
