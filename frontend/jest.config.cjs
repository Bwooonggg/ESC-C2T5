/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: "jsdom",
    testMatch: ["<rootDir>/test/**/*.test.ts", "<rootDir>/test/**/*.test.tsx"],
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: "<rootDir>/tsconfig.test.json",
            },
        ],
    },
    moduleNameMapper: {
        "\\.(css|less|scss|sass)$": "<rootDir>/test/styleMock.cjs",
    },
    setupFilesAfterEnv: ["<rootDir>/test/setupTests.ts"],
};
