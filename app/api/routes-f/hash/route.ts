import { NextRequest, NextResponse } from "next/server";
import {
  computeHash,
  INSECURE_ALGORITHMS,
  INSECURE_WARNING,
  isSupportedAlgorithm,
  isSupportedEncoding,
} from "./_lib/helpers";
import type {
  HashEncoding,
  HashErrorResponse,
  HashSuccessResponse,
} from "./_lib/types";

/**
 * POST /api/routes-f/hash
 *
 * Body:
 *   {
 *     input:      string                              // text to hash
 *     algorithm:  "md5" | "sha1" | "sha256" | "sha512"
 *     encoding?:  "hex" | "base64"                   // default: "hex"
 *   }
 *
 * Response (200):
 *   {
 *     hash:       string
 *     algorithm:  string
 *     encoding:   string
 *     warning?:   string   // present for md5 / sha1
 *   }
 *
 * Response (400):
 *   { error: string }
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<HashSuccessResponse | HashErrorResponse>> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json<HashErrorResponse>(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json<HashErrorResponse>(
      { error: "Request body must be a JSON object." },
      { status: 400 }
    );
  }

  const { input, algorithm, encoding } = body as Record<string, unknown>;

  // ── Validate `input` ──────────────────────────────────────────────────────
  if (typeof input !== "string") {
    return NextResponse.json<HashErrorResponse>(
      { error: "'input' is required and must be a string." },
      { status: 400 }
    );
  }

  // ── Validate `algorithm` ──────────────────────────────────────────────────
  if (!isSupportedAlgorithm(algorithm)) {
    return NextResponse.json<HashErrorResponse>(
      {
        error: `Unsupported algorithm '${String(algorithm)}'. Supported values: md5, sha1, sha256, sha512.`,
      },
      { status: 400 }
    );
  }

  // ── Validate `encoding` (optional) ───────────────────────────────────────
  const resolvedEncoding: HashEncoding =
    encoding === undefined ? "hex" : (encoding as HashEncoding);

  if (!isSupportedEncoding(resolvedEncoding)) {
    return NextResponse.json<HashErrorResponse>(
      {
        error: `Unsupported encoding '${String(encoding)}'. Supported values: hex, base64.`,
      },
      { status: 400 }
    );
  }

  // ── Compute hash ──────────────────────────────────────────────────────────
  const hash = computeHash(input, algorithm, resolvedEncoding);

  const response: HashSuccessResponse = {
    hash,
    algorithm,
    encoding: resolvedEncoding,
    ...(INSECURE_ALGORITHMS.has(algorithm) && { warning: INSECURE_WARNING }),
  };

  return NextResponse.json<HashSuccessResponse>(response, { status: 200 });
}

/** Respond to CORS pre-flight requests. */
export function OPTIONS(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
