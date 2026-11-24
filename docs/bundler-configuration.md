# Bundler configuration

This project uses Next.js with different bundler paths depending on command and environment.

## Dev server

- Command: `npm run dev` / `next dev`
- Bundler: **Turbopack** by default in Next 16.
- Config: `nextConfig.turbopack = {}` is present because the config also contains a webpack hook. This keeps Next from treating the config as webpack-only and allows Turbopack dev to run.

## Production build

- Command: `npm run build` / `next build`
- Bundler: **webpack** for the standard Next.js production build unless Next is explicitly configured otherwise. The current config does not opt into Turbopack production builds.
- Config source: `next.config.js` is loaded for the production build. The bundle-analyzer webpack hook only runs when `ANALYZE=true`.

## Bundle analyzer

- Command: `ANALYZE=true npm run build`
- Bundler: **webpack**. The analyzer is wired through the webpack config hook via `@next/bundle-analyzer`.
- Purpose: inspect production bundle composition and catch size regressions.

## Behavioral differences and risk

- Turbopack dev and webpack production can resolve, optimize, or tree-shake modules differently. A change that looks fine in dev can still affect production bundle size or module behavior.
- The analyzer only reflects the webpack analyzer path when `ANALYZE=true`; it is not run in normal dev and can miss regressions if not exercised.
- Because of this divergence, bundle-size regressions should be checked with `ANALYZE=true npm run build` or CI bundle checks, not inferred from dev behavior.

## Operational guidance

- Use dev for fast iteration, but validate bundle-impacting changes with a production build.
- When adding webpack-only behavior, confirm there is no Turbopack dev equivalent needed, or document the gap.
- When investigating bundle regressions, run the analyzer against the production webpack build and compare before/after output.
