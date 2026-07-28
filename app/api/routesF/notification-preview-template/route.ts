import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type PreviewTemplateResult = {
  preview_template: string;
};

type ErrorResult = {
  error: string;
};

export const MAX_TEMPLATE_LENGTH = 100;
export const DEFAULT_TEMPLATE = "{{title}} is live now!";

export const templates = new Map<string, string>();

const getQuerySchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
});

const putBodySchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
  preview_template: z
    .string()
    .min(1, "preview_template is required")
    .max(MAX_TEMPLATE_LENGTH, `preview_template must be at most ${MAX_TEMPLATE_LENGTH} characters`),
});

export async function GET(req: NextRequest): Promise<NextResponse<PreviewTemplateResult | ErrorResult>> {
  const { searchParams } = new URL(req.url);
  const validation = getQuerySchema.safeParse({ creator_id: searchParams.get("creator_id") });

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid query parameters" },
      { status: 400 },
    );
  }

  const { creator_id } = validation.data;
  const preview_template = templates.get(creator_id) ?? DEFAULT_TEMPLATE;

  return NextResponse.json({ preview_template });
}

export async function PUT(req: NextRequest): Promise<NextResponse<PreviewTemplateResult | ErrorResult>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = putBodySchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 },
    );
  }

  const { creator_id, preview_template } = validation.data;
  templates.set(creator_id, preview_template);

  return NextResponse.json({ preview_template });
}
