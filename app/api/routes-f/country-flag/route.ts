import { NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const A = 0x1f1e6; // regional indicator 'A'

/** Convert an ISO 3166-1 alpha-2 code (e.g. "NG") to its flag emoji. */
export function codeToFlag(code: string): string {
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) {
    throw new RangeError("code must be two ASCII letters");
  }
  return String.fromCodePoint(
    A + (cc.charCodeAt(0) - 65),
    A + (cc.charCodeAt(1) - 65),
  );
}

/** Convert a flag emoji (two regional indicators) back to its alpha-2 code. */
export function flagToCode(flag: string): string {
  const cps = Array.from(flag, (ch) => ch.codePointAt(0) ?? 0);
  if (cps.length !== 2 || cps.some((cp) => cp < A || cp > A + 25)) {
    throw new RangeError("flag must be two regional-indicator symbols");
  }
  return cps.map((cp) => String.fromCharCode(cp - A + 65)).join("");
}

const schema = z.object({
  mode: z.enum(["to_flag", "to_code"]),
  code: z.string().optional(),
  flag: z.string().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const result = await validateBody(request, schema);
  if (result instanceof NextResponse) return result;
  const { mode, code, flag } = result.data;

  try {
    if (mode === "to_flag") {
      if (!code) return NextResponse.json({ error: "code is required for to_flag" }, { status: 400 });
      return NextResponse.json({ flag: codeToFlag(code) });
    }
    if (!flag) return NextResponse.json({ error: "flag is required for to_code" }, { status: 400 });
    return NextResponse.json({ code: flagToCode(flag) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "invalid input" },
      { status: 400 },
    );
  }
}
