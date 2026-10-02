import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type Annotation = {
  annotation_id: string;
  vod_id: string;
  time_seconds: number;
  text: string;
  created_at: string;
};

const postSchema = z.object({
  vod_id: z.string().min(1, "vod_id is required"),
  time_seconds: z.number().int().min(0, "time_seconds must be a non-negative integer"),
  text: z.string().min(1, "text is required").max(500, "text must be 500 characters or less"),
});

const deleteSchema = z.object({
  annotation_id: z.string().min(1, "annotation_id is required"),
});

const store = new Map<string, Annotation>();
let counter = 0;

function generateAnnotationId(): string {
  counter += 1;
  return `ann-${Date.now()}-${counter}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = postSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { vod_id, time_seconds, text } = validation.data;
  const annotation_id = generateAnnotationId();

  const annotation: Annotation = {
    annotation_id,
    vod_id,
    time_seconds,
    text,
    created_at: new Date().toISOString(),
  };

  store.set(annotation_id, annotation);

  return NextResponse.json({ annotation_id }, { status: 201 });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const vod_id = searchParams.get("vod_id");

  if (!vod_id) {
    return NextResponse.json({ error: "vod_id query param is required" }, { status: 400 });
  }

  const annotations = Array.from(store.values())
    .filter((a) => a.vod_id === vod_id)
    .sort((a, b) => a.time_seconds - b.time_seconds);

  return NextResponse.json({ vod_id, annotations, total: annotations.length });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = deleteSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { annotation_id } = validation.data;

  if (!store.has(annotation_id)) {
    return NextResponse.json({ error: "Annotation not found" }, { status: 404 });
  }

  store.delete(annotation_id);

  return NextResponse.json({ deleted: true, annotation_id });
}
