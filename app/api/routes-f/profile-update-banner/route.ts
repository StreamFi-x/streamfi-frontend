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

const MIN_BANNER_WIDTH = 1200;
const MIN_BANNER_HEIGHT = 300;

type UploadResult = {
  url?: unknown;
  width?: unknown;
  height?: unknown;
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
  if (!body) {return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });}

  const username = readString(body.username);
  const upload = parseUpload(body.upload ?? body.banner);
  const bannerUrl = readString(upload?.url);
  const width = typeof upload?.width === "number" ? upload.width : null;
  const height = typeof upload?.height === "number" ? upload.height : null;

  if (!username) {return NextResponse.json({ error: "username is required" }, { status: 400 });}
  if (!bannerUrl || !isHttpsUrl(bannerUrl)) {
    return NextResponse.json({ error: "upload.url must be a valid https URL" }, { status: 400 });
  }
  if (width === null || height === null || width < MIN_BANNER_WIDTH || height < MIN_BANNER_HEIGHT) {
    return NextResponse.json(
      { error: `banner must be at least ${MIN_BANNER_WIDTH}x${MIN_BANNER_HEIGHT}` },
      { status: 400 }
    );
  }

  const { rows } = await sql`
    UPDATE users
    SET banner = ${bannerUrl}, updated_at = NOW()
    WHERE LOWER(username) = LOWER(${username})
    RETURNING id, username, banner, updated_at
  `;

  if (rows.length === 0) {return NextResponse.json({ error: "User not found" }, { status: 404 });}
  return NextResponse.json({ user: rows[0] });
}
