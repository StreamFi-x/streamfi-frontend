/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/**
 * Validate request body against a Zod schema
 * @param req - Next.js request object
 * @param schema - Zod schema to validate against
 * @returns Parsed data or NextResponse error
 */
export async function validateBody<T extends z.ZodType>(
  req: Request | NextRequest,
  schema: T
): Promise<{ data: z.infer<T> } | NextResponse> {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    return { data: parsed.data };
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
}

export function validateQuery<T extends z.ZodType>(
  reqOrParams: Request | NextRequest | URLSearchParams,
  schema: T
): { data: z.infer<T> } | NextResponse {
  try {
    let params: Record<string, string>;
    if (reqOrParams instanceof URLSearchParams) {
      params = Object.fromEntries(reqOrParams);
    } else {
      const url = new URL(reqOrParams.url);
      params = Object.fromEntries(url.searchParams);
    }
    const parsed = schema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    return { data: parsed.data };
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to parse query parameters" },
      { status: 400 }
    );
  }
}
