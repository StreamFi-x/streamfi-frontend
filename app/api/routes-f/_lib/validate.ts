import { NextResponse } from "next/server";
import { z } from "zod";

export function validateQuery<TSchema extends z.ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: TSchema
): { data: z.infer<TSchema> } | NextResponse {
  const parsed = schema.safeParse(Object.fromEntries(searchParams.entries()));

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
}

export async function validateBody<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema
): Promise<{ data: z.infer<TSchema> } | NextResponse> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

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
}
