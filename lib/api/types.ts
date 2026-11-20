export type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "MAINNET_BLOCKED"
  | "API_VERSION_SUNSET"
  | "INTERNAL_ERROR"
  | (string & {});

export interface ApiResponseMeta {
  requestId?: string;
  apiVersion?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface ApiSuccessResponse<T = Record<string, unknown>> {
  success: true;
  data: T;
  message?: string;
  meta?: ApiResponseMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code: ApiErrorCode;
  details?: unknown;
  meta?: ApiResponseMeta;
}

export type ApiResponse<T = Record<string, unknown>> =
  ApiSuccessResponse<T> | ApiErrorResponse;

export interface ApiSuccessOptions {
  status?: number;
  message?: string;
  headers?: HeadersInit;
  meta?: ApiResponseMeta;
  /**
   * Transitional compatibility flag for existing unversioned `/api/*` routes.
   * When true and `data` is a plain object, spreads top-level properties of
   * `data` alongside `{ success: true, data }` so existing frontend callers
   * continue to work without a breaking cutover. Must remain false (default)
   * on `/api/v1/*` routes.
   */
  legacyFlat?: boolean;
}

export interface ApiErrorOptions {
  status?: number;
  code?: ApiErrorCode;
  details?: unknown;
  headers?: HeadersInit;
  meta?: ApiResponseMeta;
  /**
   * Optional extra top-level fields for transitional compatibility on legacy
   * routes (for example `issues`, `requestId`, or `retryAfter`).
   */
  legacyExtra?: Record<string, unknown>;
}

export function isApiSuccess<T = Record<string, unknown>>(
  value: unknown
): value is ApiSuccessResponse<T> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.success === true && "data" in candidate;
}

export function isApiError(value: unknown): value is ApiErrorResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.success === false &&
    typeof candidate.error === "string" &&
    typeof candidate.code === "string"
  );
}

export function unwrapApiResponse<T>(response: ApiResponse<T>): T {
  if (response.success) {
    return response.data;
  }

  const err = new Error(response.error) as Error & {
    code: ApiErrorCode;
    details?: unknown;
  };
  err.code = response.code;
  if (response.details !== undefined) {
    err.details = response.details;
  }
  throw err;
}
