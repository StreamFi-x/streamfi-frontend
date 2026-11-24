# Visual regression baselines

The `visual` CI job runs the Playwright specs in this directory on `ubuntu-latest` and compares against committed PNG baselines in `custom-theme.spec.ts-snapshots/`.

## Refreshing baselines

1. Run the `Update visual baselines` GitHub Action in this repository (or on a fork branch) via `workflow_dispatch`.
2. Download the `visual-baselines` artifact from the run.
3. Replace the PNGs in `tests/visual/custom-theme.spec.ts-snapshots/` with the artifact contents and commit them.

Locally, from the repository root:

```sh
npm run test:visual -- --update-snapshots
```

Local macOS baselines must not be committed. Font rasterization differs from Ubuntu and will fail CI.

## Deterministic settings

`playwright.visual.config.ts` fixes a 1280x720 viewport, `deviceScaleFactor: 1`, reduced motion, hidden caret, dark color scheme and disabled animations. Baselines are compared with a 2% pixel ratio tolerance.
