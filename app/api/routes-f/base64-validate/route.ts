import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

export type Base64Variant = "standard" | "urlsafe" | "auto";

export interface Base64Result {
  valid: boolean;
  variant_detected: "standard" | "urlsafe" | null;
  decoded_length: number;
}

const INVALID: Base64Result = { valid: false, variant_detected: null, decoded_length: 0 };

/**
 * Validate whether `input` is well-formed base64 (standard or URL-safe):
 * charset, padding placement, and length divisibility.
 */
export function validateBase64(input: string, variant: Base64Variant = "auto"): Base64Result {
  if (input.length === 0) {
    return { valid: true, variant_detected: variant === "auto" ? "standard" : variant, decoded_length: 0 };
  }

  const hasStd = /[+/]/.test(input);
  const hasUrl = /[-_]/.test(input);
  if (hasStd && hasUrl) return INVALID; // mixed alphabets

  let detected: "standard" | "urlsafe" = hasUrl ? "urlsafe" : "standard";
  if (variant !== "auto") {
    if ((hasStd || hasUrl) && variant !== detected) return INVALID;
    detected = variant;
  }

  const charset = detected === "urlsafe" ? /^[A-Za-z0-9_-]+={0,2}$/ : /^[A-Za-z0-9+/]+={0,2}$/;
  if (!charset.test(input)) return INVALID;

  const padIdx = input.indexOf("=");
  const padding = padIdx === -1 ? 0 : input.length - padIdx;
  // padding, if present, must be 1–2 '=' all at the very end
  if (padIdx !== -1 && !/^={1,2}$/.test(input.slice(padIdx))) return INVALID;

  if (input.length % 4 === 1) return INVALID; // impossible base64 length
  if (input.length % 4 !== 0) {
    // only tolerate unpadded length for url-safe (padding is optional there)
    if (padding > 0 || detected === "standard") return INVALID;
  } else if (padding > 0 && input.length % 4 !== 0) {
    return INVALID;
  }

  const decoded_length = Math.floor((input.length - padding) * 3 / 4);
  return { valid: true, variant_detected: detected, decoded_length };
}

const schema = z.object({
  input: z.string(),
  variant: z.enum(["standard", "urlsafe", "auto"]).optional().default("auto"),
});

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) return result;
  const { input, variant } = result.data;
  return NextResponse.json(validateBase64(input, variant));
}
