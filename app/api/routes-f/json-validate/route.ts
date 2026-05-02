import { NextRequest, NextResponse } from "next/server";
import type {
  JsonValidateRequest,
  JsonValidationErrorPayload,
} from "./_lib/types";
import {
  buildContextSnippet,
  extractErrorPosition,
  getLineColumnFromPosition,
  recursivelySortKeys,
} from "./_lib/json";

const MAX_INPUT_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let body: JsonValidateRequest;

  try {
    body = (await request.json()) as JsonValidateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body.input !== "string") {
    return NextResponse.json(
      { error: "input must be a string" },
      { status: 400 }
    );
  }

  const inputSize = Buffer.byteLength(body.input, "utf8");
  if (inputSize > MAX_INPUT_BYTES) {
    return NextResponse.json(
      { error: `Input exceeds ${MAX_INPUT_BYTES} bytes` },
      { status: 413 }
    );
  }

  try {
    const parsed = JSON.parse(body.input) as unknown;
    const transformed = body.sort_keys ? recursivelySortKeys(parsed) : parsed;

    const payload: {
      valid: true;
      parsed: unknown;
      formatted?: string;
    } = {
      valid: true,
      parsed: transformed,
    };

    if (body.format) {
      payload.formatted = JSON.stringify(transformed, null, 2);
    }

    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid JSON syntax";
    const position = extractErrorPosition(message) ?? 0;
    const { line, column } = getLineColumnFromPosition(body.input, position);
    const context = buildContextSnippet(body.input, position);

    const jsonError: JsonValidationErrorPayload = {
      message,
      line,
      column,
      position,
      context,
    };

    return NextResponse.json(
      { valid: false, error: jsonError },
      { status: 400 }
    );
  }
}
