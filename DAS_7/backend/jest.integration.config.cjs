const baseConfig = require('./jest.config.cjs')

module.exports = {
    ...baseConfig,
    roots: ['<rootDir>/test/integration'],
    testPathIgnorePatterns: [],
    testTimeout: 30_000,
}
