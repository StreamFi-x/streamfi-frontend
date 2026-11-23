# Mutation testing

This repo includes Stryker configuration for mutation testing selected high-value tests.

## Scope

The initial mutation baseline targets:

- `contexts/stellar-wallet-context.tsx`
- `components/tipping/TipModal.tsx`

These areas cover Stellar wallet state and tipping flow UI behavior, where tests should fail on real logic regressions.

## Commands

Install Stryker packages when running mutation tests in an environment with dependencies available:

```bash
npm install --save-dev @stryker-mutator/core @stryker-mutator/jest-runner @stryker-mutator/typescript-checker
```

Run mutation tests:

```bash
npx stryker run
```

Reports are written to:

- `reports/mutation/mutation.html`
- `reports/mutation/mutation.json`

## Baseline mutation score

A baseline score has not been recorded in this environment because Stryker dependencies are not installed and the current workspace is low on disk. After installing dependencies, run `npx stryker run` against the configured scope and record the resulting mutation score in this document and the PR/issue notes.

## Flaky test detection

Jest test scripts include `--detectOpenHandles` to surface leaked handles that can cause flakiness or hanging runs. Use `npm run test:ci` in CI for non-watch, coverage-enabled runs.
