import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

const MAX_FILE_SIZE_BYTES = 256 * 1024;
const MAX_DIMENSION = 128;

function isValidCode(code: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]{2,19}$/.test(code);
}

async function readImageSize(
  file: File
): Promise<{ width: number; height: number }> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (file.type === "image/png") {
    if (bytes.length >= 24) {
      const width =
        (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      const height =
        (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
      return { width, height };
    }
  }

  if (file.type === "image/gif") {
    if (bytes.length >= 10) {
      const width = bytes[6] | (bytes[7] << 8);
      const height = bytes[8] | (bytes[9] << 8);
      return { width, height };
    }
  }

  throw new Error("Unsupported image format or invalid image file");
}

export async function GET(req: NextRequest): Promise<Response> {
  const username = new URL(req.url).searchParams.get("username")?.trim();
  if (!username) {
    return NextResponse.json(
      { error: "username is required" },
      { status: 400 }
    );
  }

  const { rows } = await sql`
    SELECT
      ce.id,
      ce.code,
      ce.image_url,
      ce.subscriber_only
    FROM channel_emotes ce
    JOIN users u ON u.id = ce.creator_id
    WHERE LOWER(u.username) = LOWER(${username})
    ORDER BY ce.created_at ASC
  `;

  return NextResponse.json({ emotes: rows });
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const formData = await req.formData();
  const image = formData.get("image");
  const code = String(formData.get("code") ?? "").trim();
  const subscriberOnly =
    String(formData.get("subscriber_only") ?? "false").toLowerCase() === "true";

  if (!(image instanceof File)) {
    return NextResponse.json({ error: "image is required" }, { status: 400 });
  }

  if (!["image/png", "image/gif"].includes(image.type)) {
    return NextResponse.json(
      { error: "image must be PNG or GIF" },
      { status: 400 }
    );
  }

  if (image.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "image must be <= 256KB" },
      { status: 400 }
    );
  }

  if (!isValidCode(code)) {
    return NextResponse.json(
      {
        error:
          "code must be 3-20 alphanumeric chars and must start with a letter",
      },
      { status: 400 }
    );
  }

  const { width, height } = await readImageSize(image);
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return NextResponse.json(
      { error: "image dimensions must be <= 128x128" },
      { status: 400 }
    );
  }

  const { rows: globalRows } = await sql`
    SELECT 1 FROM global_emotes WHERE LOWER(code) = LOWER(${code}) LIMIT 1
  `;
  if (globalRows.length > 0) {
    return NextResponse.json(
      { error: "code conflicts with global emote" },
      { status: 409 }
    );
  }

  const { rows: countRows } = await sql`
    SELECT COUNT(*)::int AS count
    FROM channel_emotes
    WHERE creator_id = ${session.userId}
  `;
  if ((countRows[0]?.count ?? 0) >= 5) {
    return NextResponse.json(
      { error: "free tier limit reached (5 emotes)" },
      { status: 403 }
    );
  }

  const ext = image.type === "image/png" ? "png" : "gif";
  const imageUrl = `https://cdn.streamfi.media/emotes/${session.userId}-${Date.now()}.${ext}`;

  const { rows } = await sql`
    INSERT INTO channel_emotes (
      creator_id,
      code,
      image_url,
      width,
      height,
      subscriber_only
    )
    VALUES (
      ${session.userId},
      ${code},
      ${imageUrl},
      ${width},
      ${height},
      ${subscriberOnly}
    )
    RETURNING id, code, image_url, subscriber_only
  `;

  return NextResponse.json({ emote: rows[0] }, { status: 201 });
}
