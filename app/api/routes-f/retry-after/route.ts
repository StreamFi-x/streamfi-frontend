/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { parseRetryAfterValue } from "./parse";
import type { RetryAfterRequest } from "./types";

const schema = z.object({
  header: z.string().min(1),
  now: z.string().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) {
    return result;
  }

  const { header, now } = result.data;
  const parsed = parseRetryAfterValue(header, now);

  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid Retry-After header or now timestamp" },
      { status: 400 }
    );
  }

  return NextResponse.json(parsed);
}
