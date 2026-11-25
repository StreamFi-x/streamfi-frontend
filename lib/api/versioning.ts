import { NextResponse } from "next/server";
import {
  apiBadRequest,
  apiConflict,
  apiCreated,
  apiError,
  apiForbidden,
  apiInternalError,
  apiMethodNotAllowed,
  apiNotFound,
  apiRateLimited,
  apiServiceUnavailable,
  apiSuccess,
  apiUnauthorized,
  apiValidationError,
} from "./response";
import type { ApiErrorOptions, ApiSuccessOptions } from "./types";

export const CURRENT_API_VERSION = "v1" as const;
export const SUPPORTED_API_VERSIONS = ["v1"] as const;
export const API_VERSION_HEADER = "X-API-Version";
export const API_DEPRECATION_SUPPORT_DAYS = 180;

export type ApiVersion = (typeof SUPPORTED_API_VERSIONS)[number];

export function isSupportedApiVersion(version: string): version is ApiVersion {
  return (SUPPORTED_API_VERSIONS as readonly string[]).includes(version);
}

export function extractApiVersionFromPath(
  pathname: string
): string | "unversioned" | null {
  if (pathname !== "/api" && !pathname.startsWith("/api/")) {
    return null;
  }

  const match = /^\/api\/(v\d+)(?:\/|$)/.exec(pathname);
  if (match) {
    return match[1];
  }

  return "unversioned";
}

export function withApiVersion<T extends NextResponse>(
  response: T,
  version: ApiVersion | "unversioned" = CURRENT_API_VERSION
): T {
  response.headers.set(API_VERSION_HEADER, version);
  return response;
}

export function withDeprecationHeaders<T extends NextResponse>(
  response: T,
  options: {
    sunsetDate: string | Date;
    successorPath?: string;
    deprecatedAt?: string | Date;
  }
): T {
  const deprecationValue = options.deprecatedAt
    ? `@${Math.floor(new Date(options.deprecatedAt).getTime() / 1000)}`
    : "true";
  response.headers.set("Deprecation", deprecationValue);
  response.headers.set("Sunset", new Date(options.sunsetDate).toUTCString());

  if (options.successorPath) {
    response.headers.set(
      "Link",
      `<${options.successorPath}>; rel="successor-version"`
    );
  }

  return response;
}

export function apiVersionSunset(
  retiredVersion: string,
  successorPath: string
): NextResponse {
  return apiError(
    `API version ${retiredVersion} has been retired. Migrate to ${successorPath}.`,
    {
      status: 410,
      code: "API_VERSION_SUNSET",
      details: { retiredVersion, successorPath },
      headers: {
        Link: `<${successorPath}>; rel="successor-version"`,
        [API_VERSION_HEADER]: retiredVersion,
      },
    }
  );
}

function mergeVersionOptions<
  T extends { headers?: HeadersInit; meta?: Record<string, unknown> },
>(version: ApiVersion, options: T = {} as T) {
  const headersObj: Record<string, string> = {
    [API_VERSION_HEADER]: version,
  };

  if (options.headers) {
    if (typeof (options.headers as Headers).forEach === "function") {
      (options.headers as Headers).forEach((value, key) => {
        headersObj[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      for (const [key, value] of options.headers) {
        headersObj[key] = value;
      }
    } else {
      for (const [key, value] of Object.entries(options.headers)) {
        if (value !== undefined) {
          headersObj[key] = String(value);
        }
      }
    }
  }

  return {
    ...options,
    headers: headersObj,
    meta: {
      apiVersion: version,
      ...options.meta,
    },
  };
}

export function createVersionedResponder(
  version: ApiVersion = CURRENT_API_VERSION
) {
  return {
    version,
    success<T>(
      data: T,
      options: Omit<ApiSuccessOptions, "legacyFlat"> = {}
    ): NextResponse {
      return apiSuccess(data, {
        ...mergeVersionOptions(version, options),
        legacyFlat: false,
      });
    },
    created<T>(
      data: T,
      options: Omit<ApiSuccessOptions, "status" | "legacyFlat"> = {}
    ): NextResponse {
      return apiCreated(data, {
        ...mergeVersionOptions(version, options),
        legacyFlat: false,
      });
    },
    error(message: string, options: ApiErrorOptions = {}): NextResponse {
      return apiError(message, mergeVersionOptions(version, options));
    },
    badRequest(
      message: string,
      options: Omit<ApiErrorOptions, "status"> = {}
    ): NextResponse {
      return apiBadRequest(message, mergeVersionOptions(version, options));
    },
    validationError(
      message: string,
      details: unknown,
      options: Omit<ApiErrorOptions, "status" | "code" | "details"> = {}
    ): NextResponse {
      return apiValidationError(
        message,
        details,
        mergeVersionOptions(version, options)
      );
    },
    unauthorized(
      message = "Unauthorized",
      options: Omit<ApiErrorOptions, "status"> = {}
    ): NextResponse {
      return apiUnauthorized(message, mergeVersionOptions(version, options));
    },
    forbidden(
      message = "Forbidden",
      options: Omit<ApiErrorOptions, "status"> = {}
    ): NextResponse {
      return apiForbidden(message, mergeVersionOptions(version, options));
    },
    notFound(
      message = "Resource not found",
      options: Omit<ApiErrorOptions, "status"> = {}
    ): NextResponse {
      return apiNotFound(message, mergeVersionOptions(version, options));
    },
    methodNotAllowed(
      allowedMethods: string | string[],
      message = "Method not allowed",
      options: Omit<ApiErrorOptions, "status"> = {}
    ): NextResponse {
      return apiMethodNotAllowed(
        allowedMethods,
        message,
        mergeVersionOptions(version, options)
      );
    },
    conflict(
      message: string,
      options: Omit<ApiErrorOptions, "status"> = {}
    ): NextResponse {
      return apiConflict(message, mergeVersionOptions(version, options));
    },
    rateLimited(
      message = "Too many requests",
      options: Omit<ApiErrorOptions, "status"> & {
        retryAfterSeconds?: number;
      } = {}
    ): NextResponse {
      return apiRateLimited(message, mergeVersionOptions(version, options));
    },
    serviceUnavailable(
      message = "Service unavailable",
      options: Omit<ApiErrorOptions, "status"> & {
        retryAfterSeconds?: number;
      } = {}
    ): NextResponse {
      return apiServiceUnavailable(
        message,
        mergeVersionOptions(version, options)
      );
    },
    internalError(
      message = "Internal server error",
      options: Omit<ApiErrorOptions, "status"> = {}
    ): NextResponse {
      return apiInternalError(message, mergeVersionOptions(version, options));
    },
  };
}

export const apiV1 = createVersionedResponder("v1");
