import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase();
}

function isValidTagName(tag: string): boolean {
  return /^[a-z0-9-]{1,30}$/.test(tag);
}

export async function GET(req: NextRequest): Promise<Response> {
  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase();
  if (!q) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  const { rows } = await sql`
    SELECT name
    FROM tags
    WHERE name ILIKE ${q + "%"}
    ORDER BY name ASC
    LIMIT 10
  `;

  return NextResponse.json({ tags: rows.map(r => r.name) });
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const normalized = normalizeTag(body.name ?? "");
  if (!normalized || !isValidTagName(normalized)) {
    return NextResponse.json(
      {
        error:
          "Tag must be lowercase alphanumeric/hyphen and at most 30 characters",
      },
      { status: 400 }
    );
  }

  const { rows } = await sql`
    INSERT INTO tag_suggestions (suggested_by, name, status)
    VALUES (${session.userId}, ${normalized}, 'pending')
    ON CONFLICT (suggested_by, name)
    DO UPDATE SET created_at = now()
    RETURNING id, name, status, created_at
  `;

  return NextResponse.json({ suggestion: rows[0] }, { status: 201 });
}
