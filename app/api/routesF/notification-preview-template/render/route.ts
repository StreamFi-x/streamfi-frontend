import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_TEMPLATE, MAX_TEMPLATE_LENGTH, templates } from "../route";

type RenderResult = {
  rendered_text: string;
};

type ErrorResult = {
  error: string;
};

const bodySchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
  stream_title: z.string().min(1, "stream_title is required"),
});

function interpolate(template: string, streamTitle: string): string {
  return template.replace(/\{\{title\}\}/g, streamTitle);
}

export async function POST(req: NextRequest): Promise<NextResponse<RenderResult | ErrorResult>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = bodySchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 },
    );
  }

  const { creator_id, stream_title } = validation.data;
  const template = templates.get(creator_id) ?? DEFAULT_TEMPLATE;
  const rendered_text = interpolate(template, stream_title).slice(0, MAX_TEMPLATE_LENGTH + 200);

  return NextResponse.json({ rendered_text });
}
