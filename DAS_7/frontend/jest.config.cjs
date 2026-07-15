/** @type {import('jest').Config} */
module.exports = {
  roots: ["<rootDir>/test"],
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.test.json" }],
  },
};
