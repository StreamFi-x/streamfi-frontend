# API Versioning Strategy

## Purpose

Historically all endpoints under `app/api/` were unversioned (for example `/api/streams/live`, `/api/tips/send`, `/api/users/top`). As StreamFi introduces mobile clients, third-party integrations, and webhook consumers, breaking changes to response payloads or request contracts cannot rely on a single simultaneous frontend deploy.

This document establishes the versioning convention, compatibility rules, deprecation lifecycle, and incremental migration path for StreamFi API routes.

## URL Path Prefix Convention

All new public, partner, and application API endpoints MUST live under a major version prefix:

```text
/api/v<major>/<resource>
```

Current active version: **`v1`** (`/api/v1/...`).

Examples:

- `GET /api/v1/health`
- `GET /api/v1/streams/live`
- Future breaking revision: `GET /api/v2/streams/live`

### Why URL Path Versioning

1. **Next.js App Router compatibility**: Versioned directories (`app/api/v1/...`, `app/api/v2/...`) isolate route handlers cleanly and allow independent runtime, middleware, and edge configuration per major version.
2. **CDN and Edge cache isolation**: Vercel Edge caches vary naturally by URL path without requiring custom `Vary` headers for content negotiation.
3. **Explicit consumer contracts**: Mobile apps, webhooks, and third-party SDKs declare their contract explicitly in the URL.

## Strict Response Contract for Versioned Routes

All routes under `/api/v1/*` MUST use `apiV1` (or `createVersionedResponder`) from `lib/api/versioning.ts`:

- Enforces the strict canonical `ApiResponse<T>` envelope (`{ success: true, data, meta }` / `{ success: false, error, code, details? }`) with `legacyFlat` disabled.
- Emits the `X-API-Version: v1` response header on every response (including `4xx`/`5xx` errors and `405 Method Not Allowed`).
- Sets `meta.apiVersion: "v1"` in the JSON payload.

## Breaking vs Non-Breaking Changes

### Non-Breaking (Allowed within `v1`)

- Adding new optional properties to response `data` objects
- Adding new optional request query parameters or JSON body fields
- Adding new endpoints under `/api/v1/*`
- Adding new `ApiErrorCode` values when paired with existing HTTP status semantics

### Breaking (Requires a New Major Version `v2`)

- Removing, renaming, or changing the type of an existing response field
- Changing an optional request field into a required field
- Changing HTTP status codes or error semantics for an existing failure mode
- Removing an endpoint or altering pagination/sorting semantics incompatibly

## Support Window and Deprecation Lifecycle

1. **Active**: Current major version (`v1`). Receives features, security fixes, and bug fixes.
2. **Deprecated (Minimum 180-Day Support Window)**:
   - When a successor major version (`v2`) supersedes a `v1` endpoint, `v1` remains operational for at least **180 days (6 months)** unless a critical security vulnerability requires an expedited retirement.
   - Deprecated handlers MUST attach standard headers via `withDeprecationHeaders` from `lib/api/versioning.ts`:
     - `Deprecation`: RFC 8594 deprecation marker (`true` or `@<unix-timestamp>`)
     - `Sunset`: RFC 7231 UTC timestamp of planned end-of-life
     - `Link`: `<successor-url>; rel="successor-version"`
3. **Sunset (`410 Gone`)**:
   - Once the sunset date passes, the retired endpoint returns HTTP `410 Gone` via `apiVersionSunset(retiredVersion, successorPath)` with `code: "API_VERSION_SUNSET"` for at least **30 days** so lagging clients receive an actionable migration signal.
4. **Removed**: Route handler is deleted after the sunset window concludes.

## Code Helpers (`lib/api/versioning.ts`)

- `CURRENT_API_VERSION` (`"v1"`) and `SUPPORTED_API_VERSIONS` (`["v1"]`)
- `API_VERSION_HEADER` (`"X-API-Version"`)
- `API_DEPRECATION_SUPPORT_DAYS` (`180`)
- `apiV1`: Pre-configured responder for `/api/v1/*` routes
- `createVersionedResponder(version)`: Creates a responder for future major versions (`v2`, ...)
- `extractApiVersionFromPath(pathname)` and `isSupportedApiVersion(version)`
- `withApiVersion(response, version)`
- `withDeprecationHeaders(response, { sunsetDate, successorPath, deprecatedAt })`
- `apiVersionSunset(retiredVersion, successorPath)`

## Incremental Migration Plan for Existing Unversioned `/api/*` Routes

Existing unversioned routes are NOT moved all at once in a breaking cutover. Instead, they migrate incrementally using a shared-service pattern:

1. **Extract domain logic into `lib/*`**: Move query, validation, and mutation logic into reusable modules (for example `lib/streams/live-streams.ts`).
2. **Expose `/api/v1/<resource>`**: Add the strict `apiV1` route handler calling the shared domain function (implemented today for `GET /api/v1/streams/live` alongside `GET /api/streams/live`).
3. **Keep `/api/<resource>` operational during transition**: Existing unversioned routes use `apiSuccess(..., { legacyFlat: true })` and tag responses with `X-API-Version: unversioned` where helpful so current web callers continue working unchanged.
4. **Migrate internal consumers**: Switch frontend hooks/components (`apiFetcher`) to `/api/v1/*` route-by-route.
5. **Deprecate and sunset unversioned routes**: Once telemetry confirms zero remaining traffic on the unversioned path, attach `withDeprecationHeaders` with a 180-day sunset window, then retire with `apiVersionSunset`.

### Priority Order for Retrofitting Existing Routes

1. Public read & discovery routes (`/api/v1/streams/live`, `/api/v1/users/top`, `/api/v1/users/[username]`)
2. Tipping & payment endpoints (`/api/v1/tips/*`)
3. Creator stream management & authentication (`/api/v1/streams/*`, `/api/v1/auth/*`)
4. Admin & internal operational endpoints

## Checklist for New API Routes

- [ ] Place the route handler under `app/api/v1/<domain>/<resource>/route.ts`
- [ ] Use `apiV1` from `@/lib/api` for all success and error responses
- [ ] Keep domain/DB logic in `lib/<domain>/` so handlers stay thin
- [ ] Export explicit `405` handlers via `apiV1.methodNotAllowed(...)` for unsupported HTTP methods when appropriate
- [ ] Add unit tests covering happy paths, validation failures, and `X-API-Version: v1` headers
