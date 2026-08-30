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

function stripControlCharacters(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, "");
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const body = await readBody(req);
  if (!body) {return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });}

  const username = readString(body.username);
  const bioValue = typeof body.bio === "string" ? body.bio : null;
  if (!username) {return NextResponse.json({ error: "username is required" }, { status: 400 });}
  if (bioValue === null) {return NextResponse.json({ error: "bio is required" }, { status: 400 });}

  const bio = stripControlCharacters(bioValue).trim();
  if (bio.length > 500) {
    return NextResponse.json({ error: "bio must be 500 characters or fewer" }, { status: 400 });
  }

  const { rows } = await sql`
    UPDATE users
    SET bio = ${bio}, updated_at = NOW()
    WHERE LOWER(username) = LOWER(${username})
    RETURNING id, username, bio, updated_at
  `;

  if (rows.length === 0) {return NextResponse.json({ error: "User not found" }, { status: 404 });}
  return NextResponse.json({ user: rows[0] });
}
