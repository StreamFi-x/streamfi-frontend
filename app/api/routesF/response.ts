import { NextResponse } from "next/server";
import { ROUTES_F_API_VERSION } from "./version";

type HeadersInput = HeadersInit | Headers;

/**
 * Normalize Headers or HeadersInit into HeadersInit
 */
function normalizeHeaders(headers?: HeadersInput): HeadersInit | undefined {
  if (!headers) return undefined;

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  return headers;
}

/**
 * Success response wrapper for routes-f
 */
export function routesFSuccess<T>(
  data: T,
  status: number = 200,
  headers?: HeadersInput
) {
  return NextResponse.json(
    {
      apiVersion: ROUTES_F_API_VERSION,
      success: true,
      data,
    },
    {
      status,
      headers: normalizeHeaders(headers),
    }
  );
}

/**
 * Error response wrapper for routes-f
 *
 * IMPORTANT: headers comes before extraData to avoid TS confusion
 */
export function routesFError(
  message: string,
  status: number = 400,
  headers?: HeadersInput,
  extraData?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      apiVersion: ROUTES_F_API_VERSION,
      success: false,
      error: message,
      ...extraData,
    },
    {
      status,
      headers: normalizeHeaders(headers),
    }
  );
}