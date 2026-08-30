import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

export interface HexColorResult {
  valid: boolean;
  normalized: string | null;
  has_alpha: boolean;
}

/**
 * Validate a hex color (#rgb, #rgba, #rrggbb, #rrggbbaa, with or without the
 * leading #) and normalize it to 6-digit (#rrggbb) or 8-digit (#rrggbbaa) form.
 */
export function normalizeHexColor(input: string): HexColorResult {
  const invalid: HexColorResult = { valid: false, normalized: null, has_alpha: false };
  const hex = input.trim().replace(/^#/, "").toLowerCase();

  if (!/^[0-9a-f]+$/.test(hex)) {return invalid;}

  const expand = (s: string) => [...s].map((ch) => ch + ch).join("");

  switch (hex.length) {
    case 3:
      return { valid: true, normalized: `#${expand(hex)}`, has_alpha: false };
    case 4:
      return { valid: true, normalized: `#${expand(hex)}`, has_alpha: true };
    case 6:
      return { valid: true, normalized: `#${hex}`, has_alpha: false };
    case 8:
      return { valid: true, normalized: `#${hex}`, has_alpha: true };
    default:
      return invalid;
  }
}

const schema = z.object({ color: z.string() });

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) {return result;}
  return NextResponse.json(normalizeHexColor(result.data.color));
}
