import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import { getStore, isValidCode } from "./_lib/languages";

const updateSchema = z.object({
  creator_id: z.string().min(1),
  primary: z.string().min(1),
  secondary: z.array(z.string().min(1)).max(4),
});

const getSchema = z.object({
  creator_id: z.string().min(1),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const result = validateQuery(new URL(req.url).searchParams, getSchema);
  if (result instanceof NextResponse) return result;

  const { creator_id } = result.data;
  const entry = getStore().get(creator_id);

  if (!entry) {
    return NextResponse.json(
      { primary: "", secondary: [] }
    );
  }

  return NextResponse.json({
    primary: entry.primary,
    secondary: entry.secondary,
  });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const result = await validateBody(req, updateSchema);
  if (result instanceof NextResponse) return result;

  const { creator_id, primary, secondary } = result.data;

  if (!isValidCode(primary)) {
    return NextResponse.json(
      { error: `Unsupported language code: "${primary}"` },
      { status: 400 }
    );
  }

  for (const code of secondary) {
    if (!isValidCode(code)) {
      return NextResponse.json(
        { error: `Unsupported language code: "${code}"` },
        { status: 400 }
      );
    }
  }

  if (new Set(secondary).size !== secondary.length) {
    return NextResponse.json(
      { error: "Duplicate secondary language codes" },
      { status: 400 }
    );
  }

  getStore().set(creator_id, { creator_id, primary, secondary });

  return NextResponse.json({ primary, secondary });
}
