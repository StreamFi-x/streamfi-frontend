import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { uuidSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { ensureInvitesSchema } from "./_lib/db";

const INVITE_CODE_LENGTH = 8;
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const createInviteSchema = z.object({
  stream_id: uuidSchema,
  max_uses: z.number().int().min(1).max(10000),
  expires_at: z.string().datetime({ offset: true }).optional(),
});

function generateInviteCode(): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let code = "";

  for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
    code += INVITE_ALPHABET[bytes[index] % INVITE_ALPHABET.length];
  }

  return code;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, createInviteSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { stream_id, max_uses, expires_at } = bodyResult.data;

  if (expires_at && new Date(expires_at).getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "expires_at must be in the future" },
      { status: 400 }
    );
  }

  try {
    await ensureInvitesSchema();

    const { rows: streamRows } = await sql`
      SELECT id, username, avatar, creator, is_live
      FROM users
      WHERE id = ${stream_id}
      LIMIT 1
    `;

    if (streamRows.length === 0) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    if (streamRows[0].id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateInviteCode();

      try {
        const { rows } = await sql`
          INSERT INTO route_f_stream_invites (
            code,
            stream_id,
            creator_id,
            max_uses,
            expires_at
          )
          VALUES (
            ${code},
            ${stream_id},
            ${session.userId},
            ${max_uses},
            ${expires_at ?? null}
          )
          RETURNING code, stream_id, creator_id, max_uses, use_count, expires_at, created_at
        `;

        return NextResponse.json(rows[0], { status: 201 });
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          String((error as { code?: string }).code) === "23505"
        ) {
          continue;
        }

        throw error;
      }
    }

    return NextResponse.json(
      { error: "Failed to generate a unique invite code" },
      { status: 500 }
    );
  } catch (error) {
    console.error("[invites] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
