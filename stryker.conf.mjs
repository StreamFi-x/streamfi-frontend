/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: "npm",
  reporters: ["html", "clear-text", "progress", "json"],
  testRunner: "jest",
  jest: {
    configFile: "jest.config.ts",
  },
  checkers: ["typescript"],
  tsconfigFile: "tsconfig.json",
  mutate: [
    "contexts/stellar-wallet-context.tsx",
    "components/tipping/TipModal.tsx",
  ],
  coverageAnalysis: "perTest",
  thresholds: {
    high: 80,
    low: 60,
    break: null,
  },
  timeoutMS: 60000,
  timeoutFactor: 2,
  ignoreStatic: true,
  incremental: false,
  htmlReporter: {
    fileName: "reports/mutation/mutation.html",
  },
  jsonReporter: {
    fileName: "reports/mutation/mutation.json",
  },
};

export default config;
