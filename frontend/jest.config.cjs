/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: "jsdom",
    testMatch: ["<rootDir>/test/**/*.test.ts", "<rootDir>/test/**/*.test.tsx"],
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: {
                    module: "commonjs",
                    moduleResolution: "node",
                    jsx: "react-jsx",
                    esModuleInterop: true,
                    erasableSyntaxOnly: false,
                    strict: true,
                },
            },
        ],
    },
};
