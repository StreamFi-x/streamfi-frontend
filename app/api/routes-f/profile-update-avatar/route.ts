import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type UploadResult = {
  url?: unknown;
  contentType?: unknown;
  size?: unknown;
};

function parseUpload(value: unknown): UploadResult | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UploadResult)
    : null;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const body = await readBody(req);
  if (!body) return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });

  const username = readString(body.username);
  const upload = parseUpload(body.upload ?? body.avatar);
  const avatarUrl = readString(upload?.url);
  const contentType = readString(upload?.contentType);
  const size = typeof upload?.size === "number" ? upload.size : null;

  if (!username) return NextResponse.json({ error: "username is required" }, { status: 400 });
  if (!avatarUrl || !isHttpsUrl(avatarUrl)) {
    return NextResponse.json({ error: "upload.url must be a valid https URL" }, { status: 400 });
  }
  if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json({ error: "unsupported avatar content type" }, { status: 400 });
  }
  if (size === null || size <= 0 || size > MAX_AVATAR_SIZE_BYTES) {
    return NextResponse.json({ error: "avatar size exceeds the 5MB limit" }, { status: 400 });
  }

  const { rows } = await sql`
    UPDATE users
    SET avatar = ${avatarUrl}, updated_at = NOW()
    WHERE LOWER(username) = LOWER(${username})
    RETURNING id, username, avatar, updated_at
  `;

  if (rows.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ user: rows[0] });
}
