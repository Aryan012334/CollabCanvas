/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@repo/backend-common/(.*)$": "<rootDir>/../../packages/backend-common/src/$1",
    "^@repo/db/(.*)$": "<rootDir>/../../packages/db/src/$1",
  },
  clearMocks: true,
  testTimeout: 15000,
};
