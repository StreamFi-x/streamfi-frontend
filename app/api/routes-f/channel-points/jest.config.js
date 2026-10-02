module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": ["babel-jest", { presets: ["next/babel"] }],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  rootDir: "../../../../",
  testMatch: [
    "<rootDir>/app/api/routes-f/channel-points/__tests__/**/*.test.ts",
  ],
  setupFilesAfterEnv: ["<rootDir>/app/api/routes-f/channel-points/__tests__/setup.ts"],
};