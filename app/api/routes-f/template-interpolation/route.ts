import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import {
  interpolateTemplate,
  type MissingMode,
} from "@/app/api/routes-f/_lib/templateInterpolation";

const interpolationBodySchema = z.object({
  template: z.string(),
  values: z.any(),
  on_missing: z.enum(["empty", "keep", "error"]).optional(),
});

export async function POST(req: NextRequest) {
  const validated = await validateBody(req, interpolationBodySchema);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const { template, values, on_missing } = validated.data;
  const mode = (on_missing as MissingMode) ?? "empty";

  const result = interpolateTemplate(template, values, mode);
  if (mode === "error" && result.missing_keys.length > 0) {
    return NextResponse.json(
      {
        error: "Missing values for template placeholders.",
        missing_keys: result.missing_keys,
      },
      { status: 400 }
    );
  }

  return NextResponse.json(result);
}
