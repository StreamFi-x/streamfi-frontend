import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { invalidateUserCaches } from "@/lib/cache/invalidation";
import {
  extractPublicIdFromUrl,
  deleteImage,
  importRemoteImage,
} from "@/utils/upload/cloudinary";

const THUMBNAIL_RULES = {
  folder: "stream-thumbnails",
  allowedFormats: ["jpg", "png", "webp"],
  maxBytes: 10 * 1024 * 1024,
  minWidth: 1280,
  minHeight: 720,
};

/** Removes a previous custom thumbnail if it is one of our Cloudinary copies. */
async function deleteStoredThumbnail(url: unknown): Promise<void> {
  const publicId =
    typeof url === "string" ? extractPublicIdFromUrl(url) : null;
  if (publicId) {
    await deleteImage(publicId).catch(error =>
      console.error("[routes-f/preview/custom] old thumbnail cleanup:", error)
    );
  }
}

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {return session.response;}

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

  // Cloudinary fetches and validates the image (#1419): this server never
  // downloads the user-supplied URL, and the stored copy does not depend on
  // the original host staying up.
  const imported = await importRemoteImage(publicUrl, THUMBNAIL_RULES);
  if (!imported.ok) {
    return NextResponse.json(
      { error: imported.error },
      { status: imported.status }
    );
  }

  const generatedAt = new Date().toISOString();

  try {
    const { rows } = await sql`
      WITH previous AS (
        SELECT creator->>'customThumbnailUrl' AS url FROM users WHERE id = ${session.userId}
      )
      UPDATE users
      SET creator = jsonb_set(
        jsonb_set(COALESCE(creator, '{}'::jsonb), '{customThumbnailUrl}', to_jsonb(${imported.url}::text), true),
        '{customThumbnailUpdatedAt}',
        to_jsonb(${generatedAt}::text),
        true
      ),
      updated_at = NOW()
      FROM previous
      WHERE id = ${session.userId}
      RETURNING previous.url AS previous_url
    `;
    await invalidateUserCaches({ id: session.userId });
    await deleteStoredThumbnail(rows[0]?.previous_url);

    return NextResponse.json({
      type: "custom",
      url: imported.url,
      generated_at: generatedAt,
      is_live: true,
    });
  } catch (error) {
    await deleteImage(imported.publicId).catch(() => undefined);
    console.error("[routes-f/preview/custom] POST error:", error);
    return NextResponse.json(
      { error: "Failed to save custom thumbnail" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {return session.response;}

  try {
    const { rows } = await sql`
      WITH previous AS (
        SELECT creator->>'customThumbnailUrl' AS url FROM users WHERE id = ${session.userId}
      )
      UPDATE users
      SET creator = (COALESCE(creator, '{}'::jsonb) - 'customThumbnailUrl' - 'customThumbnailUpdatedAt'),
          updated_at = NOW()
      FROM previous
      WHERE id = ${session.userId}
      RETURNING mux_playback_id, is_live, previous.url AS previous_url
    `;
    await invalidateUserCaches({ id: session.userId });
    await deleteStoredThumbnail(rows[0]?.previous_url);

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
