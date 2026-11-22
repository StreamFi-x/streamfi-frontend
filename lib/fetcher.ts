import { isApiError, isApiSuccess, type ApiErrorCode } from "@/lib/api/types";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: ApiErrorCode;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: ApiErrorCode,
    details?: unknown
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function fetcher<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = typeof body?.error === "string" ? `: ${body.error}` : "";
    } catch {
      // Keep the HTTP status when the server returns a non-JSON error page.
    }
    throw new Error(`Request failed (${response.status})${detail}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Typed fetch helper for endpoints returning the canonical `ApiResponse<T>`
 * envelope (such as `/api/v1/*` routes). Unwraps `data` on success and throws
 * `ApiRequestError` with `status`, `code`, and `details` on failure.
 */
export async function apiFetcher<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    throw new ApiRequestError(
      `Request failed (${response.status})`,
      response.status
    );
  }

  if (!response.ok) {
    if (isApiError(payload)) {
      throw new ApiRequestError(
        payload.error,
        response.status,
        payload.code,
        payload.details
      );
    }
    const fallbackMsg =
      typeof (payload as { error?: unknown })?.error === "string"
        ? (payload as { error: string }).error
        : `Request failed (${response.status})`;
    throw new ApiRequestError(fallbackMsg, response.status);
  }

  if (isApiSuccess<T>(payload)) {
    return payload.data;
  }

  throw new ApiRequestError(
    "Unexpected API response envelope",
    response.status
  );
}
