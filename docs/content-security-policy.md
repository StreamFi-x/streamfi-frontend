# Content Security Policy

The application sends a nonce-based `Content-Security-Policy-Report-Only` header from `proxy.ts`. It is intentionally report-only during rollout. Do not switch to `Content-Security-Policy` until CSP reports have been reviewed against production traffic and all legitimate resources have been allowlisted.

## Third-party resource changes

When adding or changing a script, stylesheet, font, image, media player, iframe, or network endpoint, update `buildCsp` in `proxy.ts` in the matching directive. Include the provider's exact origins where possible; avoid broad wildcards. Never add `unsafe-inline` or `unsafe-eval` to `script-src`. Inline scripts must carry the request nonce, and user-controlled JSON-LD must use `serializeJsonLd`.

## Rollout

1. Deploy in report-only mode and review `POST /api/security/csp-report` telemetry across representative production routes and integrations.
2. Resolve violations by removing unnecessary inline behavior or explicitly allowlisting the required origin. Keep reports bounded and do not log cookies, credentials, or full report payloads.
3. Verify Privy, wallet connections, Mux playback, user-generated profile content, fonts, avatars, and websocket traffic in production.
4. Only after the report window is clean, change the response header to enforced `Content-Security-Policy` and continue monitoring.

The report endpoint logs only selected violation fields and caps request size and report count. Report-only telemetry is not a substitute for fixing an injection flaw.