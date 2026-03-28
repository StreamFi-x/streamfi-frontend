/**
 * Shared request validation helpers for routes-f endpoints.
 *
 * Usage (body):
 *   const result = await validateBody(request, schema);
 *   if (result instanceof NextResponse) return result; // 400
 *   const { data } = result;
 *
 * Usage (query params):
 *   const result = validateQuery(searchParams, schema);
 *   if (result instanceof NextResponse) return result; // 400
 *   const { data } = result;
 */

import { z } from "zod";
import { NextResponse } from "next/server";

function formatIssues(issues: z.ZodIssue[]) {
  return issues.map(issue => ({
    field: issue.path.join(".") || "body",
    message: issue.message,
  }));
}

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Returns { data } on success, or a 400 NextResponse with per-field errors.
 */
export async function validateBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ data: T } | NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: formatIssues(result.error.issues),
      },
      { status: 400 }
    );
  }

  return { data: result.data };
}

/**
 * Validate URLSearchParams against a Zod schema.
 * Returns { data } on success, or a 400 NextResponse with per-field errors.
 */
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): { data: T } | NextResponse {
  const raw = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(raw);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: formatIssues(result.error.issues),
      },
      { status: 400 }
    );
  }

  return { data: result.data };
}
