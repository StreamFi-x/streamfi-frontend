# Security CI audit

Audit date: 2026-11-22. Source of truth: `.github/workflows/security.yml`.

## What the workflow checks today

| Job                 | Trigger                                               | What it actually does                                                                                                                                       | Depth                                                                                                                                                             |
| ------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `secret-scanning`   | Pull requests to `main`/`dev`, pushes to `main`/`dev` | TruffleHog with `--only-verified`, scanning the PR diff (`base` default branch to `HEAD`) or the push range (`before` to `after`). Full history is fetched. | Verified secrets only, on changed commits. Unverified findings and secrets already in history are not reported.                                                   |
| `sast-codeql`       | Pull requests, pushes, weekly schedule                | CodeQL `init` plus `analyze` for `javascript-typescript` with the default query suite. Uploads results as security events.                                  | Real static analysis. No custom query pack is configured.                                                                                                         |
| `dependency-review` | Pull requests only                                    | GitHub dependency review at `fail-on-severity: high`.                                                                                                       | Checks vulnerabilities introduced by the dependency diff of a PR. It does not scan the full installed tree, and it does not run on pushes or the weekly schedule. |

## Gaps found

1. No full dependency-tree scan. A vulnerability that already exists in the lockfile, or one disclosed after a dependency was added, is not caught by `dependency-review` on pushes or scheduled runs.
2. TruffleHog is limited to `--only-verified` findings on changed commits, which is deliberate to limit noise but means unverified candidates are not surfaced.

## Upgrade applied

A `dependency-audit` job was added to `security.yml`. It installs the locked production dependency tree with `npm ci --legacy-peer-deps`, runs `npm audit --json --omit=dev`, and compares the result against `security/audit-baseline.json` on pull requests, pushes to `main`/`dev`, and the weekly schedule. The job fails when a change introduces a high or critical advisory that is not already in the baseline, and uploads the full audit report as an artifact. This complements CodeQL (source analysis) and dependency review (PR diff) with a full-tree check on every trigger.

At audit time the production tree already has 74 advisories (36 high, 2 critical), mostly inherited from the Privy and WalletConnect dependency chains. A blocking `npm audit --audit-level=high` would fail every PR from day one, so the 20 distinct high/critical advisory IDs are tracked as a baseline. When a dependency upgrade resolves any of them, refresh the baseline with `node scripts/audit-baseline.mjs audit-report.json --update-baseline`.

No existing scanner was replaced. CodeQL remains the SAST control and TruffleHog remains the secret-scanning control.

## Route-level risk note

`app/api/auth/export-key/route.ts` and `app/api/auth/regenerate-wallet/route.ts` sit next to custodial key material, so the CodeQL job and the full dependency audit are load-bearing controls for this repository. Changes to those routes should stay covered by both.
