import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { KNOWN_SOURCES, SAFETY_LIST } from "./safety-list";

type SafetyCheckResponse = {
  viewer_id: string;
  on_list: boolean;
  list_source?: string;
  flagged_at?: string;
};

const bodySchema = z.object({
  viewer_id: z.string().min(1, "viewer_id is required"),
  source: z.string().min(1).optional(),
});

export async function POST(
  req: NextRequest
): Promise<NextResponse<SafetyCheckResponse | { error: string }>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = bodySchema.safeParse(raw);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  const { viewer_id, source } = validation.data;

  if (source !== undefined && !(KNOWN_SOURCES as readonly string[]).includes(source)) {
    return NextResponse.json(
      { error: `Unknown source. Supported: ${KNOWN_SOURCES.join(", ")}` },
      { status: 400 }
    );
  }

  const match = SAFETY_LIST.find(
    (entry) =>
      entry.viewer_id === viewer_id &&
      (source === undefined || entry.list_source === source)
  );

  if (!match) {
    return NextResponse.json({ viewer_id, on_list: false });
  }

  return NextResponse.json({
    viewer_id,
    on_list: true,
    list_source: match.list_source,
    flagged_at: match.flagged_at,
  });
}
