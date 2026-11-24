import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const INTERNAL_ERROR_MESSAGE = "An unexpected error occurred. Please try again later.";

/**
 * Creates a sanitized JSON error response.
 * Logs the full error via the structured logger for debugging, but returns only a safe public message.
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
  const status = options.status ?? 500;
  logger.error("API error response", error, {
    context: options.context,
    status,
  });
  const body = {
    error: options.publicMessage ?? INTERNAL_ERROR_MESSAGE,
    ...(options.extra ?? {}),
  };
  return NextResponse.json(body, {
    status,
    headers: options.headers,
  });
}
