import { NextResponse } from "next/server";

export const INTERNAL_ERROR_MESSAGE = "An unexpected error occurred. Please try again later.";

/**
 * Creates a sanitized JSON error response.
 * Logs the full error to console.error for debugging, but returns only a safe public message.
 */
export function createSanitizedErrorResponse(
  error: unknown,
  options: {
    context: string;
    publicMessage?: string;
    status?: number;
    extra?: Record<string, unknown>;
    headers?: HeadersInit;
  }
): ReturnType<typeof NextResponse.json> {
  console.error(`[${options.context}]`, error);
  const body = {
    error: options.publicMessage ?? INTERNAL_ERROR_MESSAGE,
    ...(options.extra ?? {}),
  };
  return NextResponse.json(body, {
    status: options.status ?? 500,
    headers: options.headers,
  });
}
