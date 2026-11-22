# API Response Format Contract

Every Next.js route handler under `app/api/` should return JSON conforming to the shared `ApiResponse<T>` contract defined in `lib/api/types.ts` (re-exported from `types/api.ts`) using the response builder helpers in `lib/api/response.ts`.

## Canonical Envelope

### Success Response (`ApiSuccessResponse<T>`)

```ts
export interface ApiSuccessResponse<T = Record<string, unknown>> {
  success: true;
  data: T;
  message?: string;
  meta?: ApiResponseMeta;
}
```

Example:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "apiVersion": "v1"
  },
  "message": "Environment check completed",
  "meta": {
    "apiVersion": "v1"
  }
}
```

### Error Response (`ApiErrorResponse`)

```ts
export interface ApiErrorResponse {
  success: false;
  error: string;
  code: ApiErrorCode;
  details?: unknown;
  meta?: ApiResponseMeta;
}
```

Example:

```json
{
  "success": false,
  "error": "Invalid request body",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "fiat_amount_cents",
      "message": "fiat_amount_cents must be a positive integer"
    }
  ]
}
```

## Status Code to Error Code Mapping

| HTTP Status | Default `code`        | Helper Function                      |
| ----------- | --------------------- | ------------------------------------ |
| 400         | `BAD_REQUEST`         | `apiBadRequest(message, options)`    |
| 400         | `VALIDATION_ERROR`    | `apiValidationError(msg, details)`   |
| 401         | `UNAUTHORIZED`        | `apiUnauthorized(message, options)`  |
| 403         | `FORBIDDEN`           | `apiForbidden(message, options)`     |
| 404         | `NOT_FOUND`           | `apiNotFound(message, options)`      |
| 405         | `METHOD_NOT_ALLOWED`  | `apiMethodNotAllowed(allow, msg)`    |
| 409         | `CONFLICT`            | `apiConflict(message, options)`      |
| 410         | `API_VERSION_SUNSET`  | `apiVersionSunset(ver, successor)`   |
| 429         | `RATE_LIMITED`        | `apiRateLimited(message, options)`   |
| 500         | `INTERNAL_ERROR`      | `apiInternalError(message, options)` |
| 503         | `SERVICE_UNAVAILABLE` | `apiServiceUnavailable(msg, opts)`   |

Route handlers may override `code` with domain-specific identifiers such as `MAINNET_BLOCKED` or `ACCOUNT_PENDING_DELETION`.

## Server Usage

### Versioned Routes (`/api/v1/*`)

Always use `apiV1` from `@/lib/api`. `apiV1` enforces the strict canonical envelope (`legacyFlat` disabled) and sets the `X-API-Version: v1` header plus `meta.apiVersion: "v1"`.

```ts
import { apiV1 } from "@/lib/api";

export async function GET() {
  return apiV1.success({ status: "ok" });
}

export async function POST() {
  return apiV1.methodNotAllowed("GET");
}
```

### Legacy Unversioned Routes (`/api/*`)

When migrating existing unversioned routes incrementally without breaking current frontend callers:

- Use `apiSuccess(data, { legacyFlat: true })` / `apiCreated(data, { legacyFlat: true })`.
  This emits both the canonical `{ success: true, data }` structure and preserves top-level keys of `data` during the transition period.
- Use `apiBadRequest`, `apiNotFound`, `apiConflict`, `apiRateLimited`, `apiInternalError`, etc. for all errors so every error response carries `{ success: false, error, code }`.

## Client Helpers

- Type guards in `lib/api/types.ts`: `isApiSuccess<T>(value)`, `isApiError(value)`, and `unwrapApiResponse<T>(response)`.
- `apiFetcher<T>(url, init)` in `lib/fetcher.ts`: fetches strict `ApiResponse<T>` endpoints (such as `/api/v1/*`), unwraps `response.data`, and throws `ApiRequestError` containing `status`, `code`, and `details` on failure.

## Migrated Routes

The following routes have been migrated to `@/lib/api`:

- Tips:
  - `POST /api/tips/send`
  - `POST /api/tips/get-quote`
  - `GET /api/tips/[username]`
  - `POST /api/tips/refresh-total`
- Streams:
  - `GET /api/streams/live`
  - `POST /api/streams/create`
  - `DELETE /api/streams/delete` (and `GET` returning `405 Method Not Allowed`)
  - `POST / DELETE /api/streams/start`
  - `GET /api/streams/[wallet]`
  - `GET /api/streams/key`
  - `PATCH /api/streams/update`
- Users:
  - `GET /api/users/top`
  - `POST /api/users/register` (and `GET` returning `405`)
  - `POST /api/users/follow`
  - `GET /api/users/wallet/[publicKey]` (and `POST` returning `405`)
  - `GET / PATCH /api/users/preferences`
  - `GET /api/users/[username]/stats`
- Reference / Maintenance / Versioned:
  - `POST /api/waitlist/subscribe`
  - `GET /api/debug/env` (including `checkDebugSecret` in `lib/debug-auth.ts`)
  - `GET /api/v1/health`
  - `GET /api/v1/streams/live`

Remaining unversioned routes (`admin/*`, `auth/*`, `routes-f/*`, remaining `streams/*` sub-routes) should be migrated incrementally whenever modified or promoted into `/api/v1/`.
