import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import sharp from "sharp";

const MAX_THUMBNAIL_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MIN_WIDTH = 1280;
const MIN_HEIGHT = 720;

async function validateRemoteImage(publicUrl: string) {
  const headResponse = await fetch(publicUrl, {
    method: "HEAD",
    cache: "no-store",
  });

  if (!headResponse.ok) {
    return { ok: false, error: "public_url is not reachable" };
  }

  const contentType = headResponse.headers.get("content-type") ?? "";
  const mime = contentType.split(";")[0].trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return { ok: false, error: "Image type must be JPEG, PNG, or WebP" };
  }

  const contentLengthRaw = headResponse.headers.get("content-length") ?? "0";
  const contentLength = Number.parseInt(contentLengthRaw, 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_THUMBNAIL_BYTES) {
    return { ok: false, error: "Image exceeds 10MB limit" };
  }

  const probeResponse = await fetch(publicUrl, { cache: "no-store" });
  if (!probeResponse.ok) {
    return { ok: false, error: "public_url could not be fetched" };
  }

  const contentTypeFromGet = probeResponse.headers.get("content-type") ?? "";
  const mimeFromGet = contentTypeFromGet.split(";")[0].trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeFromGet)) {
    return { ok: false, error: "Image type must be JPEG, PNG, or WebP" };
  }

  const arrayBuffer = await probeResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.byteLength > MAX_THUMBNAIL_BYTES) {
    return { ok: false, error: "Image exceeds 10MB limit" };
  }

  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    return { ok: false, error: "Image must be at least 1280x720" };
  }

  return { ok: true };
}

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  let body: { public_url?: string };
  try {
    body = (await req.json()) as { public_url?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const publicUrl = body.public_url?.trim();
  if (!publicUrl) {
    return NextResponse.json(
      { error: "public_url is required" },
      { status: 400 }
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(publicUrl);
  } catch {
    return NextResponse.json(
      { error: "public_url must be a valid URL" },
      { status: 400 }
    );
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json(
      { error: "public_url must be HTTP or HTTPS" },
      { status: 400 }
    );
  }

  const validation = await validateRemoteImage(publicUrl);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const generatedAt = new Date().toISOString();

  try {
    await sql`
      UPDATE users
      SET creator = jsonb_set(
        jsonb_set(COALESCE(creator, '{}'::jsonb), '{customThumbnailUrl}', to_jsonb(${publicUrl}::text), true),
        '{customThumbnailUpdatedAt}',
        to_jsonb(${generatedAt}::text),
        true
      ),
      updated_at = NOW()
      WHERE id = ${session.userId}
    `;

    return NextResponse.json({
      type: "custom",
      url: publicUrl,
      generated_at: generatedAt,
      is_live: true,
    });
  } catch (error) {
    console.error("[routes-f/preview/custom] POST error:", error);
    return NextResponse.json(
      { error: "Failed to save custom thumbnail" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  try {
    const { rows } = await sql`
      UPDATE users
      SET creator = (COALESCE(creator, '{}'::jsonb) - 'customThumbnailUrl' - 'customThumbnailUpdatedAt'),
          updated_at = NOW()
      WHERE id = ${session.userId}
      RETURNING mux_playback_id, is_live
    `;

    const user = rows[0];
    const playbackId =
      user && typeof user.mux_playback_id === "string"
        ? user.mux_playback_id
        : "";
    const fallbackUrl = playbackId
      ? `https://image.mux.com/${playbackId}/thumbnail.jpg?time=5`
      : null;

    return NextResponse.json({
      ok: true,
      type: fallbackUrl ? "mux_auto" : "placeholder",
      url: fallbackUrl,
      generated_at: new Date().toISOString(),
      is_live: Boolean(user?.is_live),
    });
  } catch (error) {
    console.error("[routes-f/preview/custom] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to remove custom thumbnail" },
      { status: 500 }
    );
  }
}
