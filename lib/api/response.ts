import { NextResponse } from "next/server";
import type {
  ApiErrorCode,
  ApiErrorOptions,
  ApiErrorResponse,
  ApiSuccessOptions,
  ApiSuccessResponse,
} from "./types";

/**
 * Normalizes HeadersInit into a plain Record<string, string> so both real
 * NextResponse.json and Jest mocks spreading `init?.headers` preserve headers.
 */
function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) {
    return result;
  }

  if (typeof (headers as Headers).forEach === "function") {
    (headers as Headers).forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      result[key] = value;
    }
    return result;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      result[key] = String(value);
    }
  }
  return result;
}

function statusToErrorCode(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 405:
      return "METHOD_NOT_ALLOWED";
    case 409:
      return "CONFLICT";
    case 410:
      return "API_VERSION_SUNSET";
    case 422:
      return "VALIDATION_ERROR";
    case 429:
      return "RATE_LIMITED";
    case 503:
      return "SERVICE_UNAVAILABLE";
    default:
      return "INTERNAL_ERROR";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function apiSuccess<T>(
  data: T,
  options: ApiSuccessOptions = {}
): NextResponse {
  const { status = 200, message, headers, meta, legacyFlat = false } = options;

  const envelope: ApiSuccessResponse<T> = {
    success: true,
    data,
    ...(message !== undefined ? { message } : {}),
    ...(meta !== undefined ? { meta } : {}),
  };

  const body =
    legacyFlat && isPlainObject(data)
      ? {
          ...data,
          ...envelope,
        }
      : envelope;

  const normalizedHeaders = normalizeHeaders(headers);
  return NextResponse.json(body, {
    status,
    ...(Object.keys(normalizedHeaders).length > 0
      ? { headers: normalizedHeaders }
      : {}),
  });
}

export function apiCreated<T>(
  data: T,
  options: Omit<ApiSuccessOptions, "status"> = {}
): NextResponse {
  return apiSuccess(data, { ...options, status: 201 });
}

export function apiError(
  message: string,
  options: ApiErrorOptions = {}
): NextResponse {
  const {
    status = 500,
    code = statusToErrorCode(status),
    details,
    headers,
    meta,
    legacyExtra,
  } = options;

  const envelope: ApiErrorResponse = {
    success: false,
    error: message,
    code,
    ...(details !== undefined ? { details } : {}),
    ...(meta !== undefined ? { meta } : {}),
  };

  const body = legacyExtra
    ? {
        ...legacyExtra,
        ...envelope,
      }
    : envelope;

  const normalizedHeaders = normalizeHeaders(headers);
  return NextResponse.json(body, {
    status,
    ...(Object.keys(normalizedHeaders).length > 0
      ? { headers: normalizedHeaders }
      : {}),
  });
}

export function apiBadRequest(
  message: string,
  options: Omit<ApiErrorOptions, "status"> = {}
): NextResponse {
  return apiError(message, { ...options, status: 400 });
}

export function apiValidationError(
  message: string,
  details: unknown,
  options: Omit<ApiErrorOptions, "status" | "code" | "details"> = {}
): NextResponse {
  return apiError(message, {
    ...options,
    status: 400,
    code: "VALIDATION_ERROR",
    details,
  });
}

export function apiUnauthorized(
  message = "Unauthorized",
  options: Omit<ApiErrorOptions, "status"> = {}
): NextResponse {
  return apiError(message, { ...options, status: 401 });
}

export function apiForbidden(
  message = "Forbidden",
  options: Omit<ApiErrorOptions, "status"> = {}
): NextResponse {
  return apiError(message, { ...options, status: 403 });
}

export function apiNotFound(
  message = "Resource not found",
  options: Omit<ApiErrorOptions, "status"> = {}
): NextResponse {
  return apiError(message, { ...options, status: 404 });
}

export function apiMethodNotAllowed(
  allowedMethods: string | string[],
  message = "Method not allowed",
  options: Omit<ApiErrorOptions, "status"> = {}
): NextResponse {
  const allowValue = Array.isArray(allowedMethods)
    ? allowedMethods.join(", ")
    : allowedMethods;
  const headers = {
    Allow: allowValue,
    ...normalizeHeaders(options.headers),
  };
  return apiError(message, { ...options, status: 405, headers });
}

export function apiConflict(
  message: string,
  options: Omit<ApiErrorOptions, "status"> = {}
): NextResponse {
  return apiError(message, { ...options, status: 409 });
}

export function apiRateLimited(
  message = "Too many requests",
  options: Omit<ApiErrorOptions, "status"> & {
    retryAfterSeconds?: number;
  } = {}
): NextResponse {
  const { retryAfterSeconds, headers: rawHeaders, ...rest } = options;
  const headers = {
    ...(retryAfterSeconds !== undefined
      ? { "Retry-After": String(retryAfterSeconds) }
      : {}),
    ...normalizeHeaders(rawHeaders),
  };
  return apiError(message, { ...rest, status: 429, headers });
}

export function apiServiceUnavailable(
  message = "Service unavailable",
  options: Omit<ApiErrorOptions, "status"> & {
    retryAfterSeconds?: number;
  } = {}
): NextResponse {
  const { retryAfterSeconds, headers: rawHeaders, ...rest } = options;
  const headers = {
    ...(retryAfterSeconds !== undefined
      ? { "Retry-After": String(retryAfterSeconds) }
      : {}),
    ...normalizeHeaders(rawHeaders),
  };
  return apiError(message, { ...rest, status: 503, headers });
}

export function apiInternalError(
  message = "Internal server error",
  options: Omit<ApiErrorOptions, "status"> = {}
): NextResponse {
  return apiError(message, { ...options, status: 500 });
}
