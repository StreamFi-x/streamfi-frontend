import { NextResponse } from "next/server";
import { ZodSchema, ZodError } from "zod";

export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): { data: T } | NextResponse {
  const obj: Record<string, unknown> = {};
  searchParams.forEach((value, key) => {
    if (obj[key]) {
      if (Array.isArray(obj[key])) {
        (obj[key] as string[]).push(value);
      } else {
        obj[key] = [obj[key], value];
      }
    } else {
      obj[key] = value;
    }
  });

  try {
    const data = schema.parse(obj);
    return { data };
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }
}

export async function validateBody<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<{ data: T } | NextResponse> {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    return { data };
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
