/**
 * POST /api/routes-f/validate
 *
 * Dev-only endpoint for testing shared Zod schemas interactively.
 * Returns 404 in production (NODE_ENV !== 'development').
 *
 * Request body:
 *   { "schema_name": "username" | "stellarPublicKey" | "usdcAmount" | "pagination" | "period" | "email" | "url" | "uuid",
 *     "data": <value to validate> }
 *
 * Success response (valid):
 *   { "valid": true, "parsed": <parsed value> }
 *
 * Error response (invalid):
 *   { "valid": false, "issues": [{ "field": "...", "message": "..." }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  stellarPublicKeySchema,
  usernameSchema,
  usdcAmountSchema,
  paginationSchema,
  periodSchema,
  emailSchema,
  urlSchema,
  uuidSchema,
} from "@/app/api/routes-f/_lib/schemas";

const SCHEMA_MAP: Record<string, z.ZodSchema<unknown>> = {
  stellarPublicKey: stellarPublicKeySchema,
  username: usernameSchema,
  usdcAmount: usdcAmountSchema,
  pagination: paginationSchema,
  period: periodSchema,
  email: emailSchema,
  url: urlSchema,
  uuid: uuidSchema,
};

const requestSchema = z.object({
  schema_name: z.string().min(1, "schema_name is required"),
  data: z.unknown(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map(i => ({
          field: i.path.join(".") || "body",
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  const { schema_name, data } = parsed.data;
  const schema = SCHEMA_MAP[schema_name];

  if (!schema) {
    return NextResponse.json(
      {
        error: `Unknown schema_name "${schema_name}". Available: ${Object.keys(SCHEMA_MAP).join(", ")}`,
      },
      { status: 400 }
    );
  }

  const result = schema.safeParse(data);
  if (result.success) {
    return NextResponse.json({ valid: true, parsed: result.data });
  }

  return NextResponse.json({
    valid: false,
    issues: result.error.issues.map(i => ({
      field: i.path.join(".") || "value",
      message: i.message,
    })),
  });
}
