import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

function isValidCode(code: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]{2,19}$/.test(code);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;
  const body = await req.json();
  const code = String(body.code ?? "").trim();

  if (!isValidCode(code)) {
    return NextResponse.json(
      {
        error:
          "code must be 3-20 alphanumeric chars and must start with a letter",
      },
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

  const result = await sql`
    UPDATE channel_emotes
    SET code = ${code}
    WHERE id = ${id} AND creator_id = ${session.userId}
    RETURNING id, code, image_url, subscriber_only
  `;

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Emote not found" }, { status: 404 });
  }

  return NextResponse.json({ emote: result.rows[0] });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;

  const result = await sql`
    DELETE FROM channel_emotes
    WHERE id = ${id} AND creator_id = ${session.userId}
    RETURNING id
  `;

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Emote not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
