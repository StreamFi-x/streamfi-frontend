import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const purgeSchema = z
  .object({
    tag: z.string().min(1).max(200).optional(),
    key: z.string().min(1).max(500).optional(),
    prefix: z.string().min(1).max(500).optional(),
  })
  .refine(
    body => Boolean(body.tag || body.key || body.prefix),
    "At least one of tag, key, or prefix is required"
  );

async function verifyAdminSession(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return { ok: false as const, response: session.response };
  }

  const { rows } = await sql`
    SELECT 1
    FROM users
    WHERE id = ${session.userId}
      AND (
        is_admin = TRUE
        OR role = 'admin'
      )
    LIMIT 1
  `;

  if (rows.length === 0) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, session };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = await verifyAdminSession(req);
    if (!auth.ok) {
      return auth.response;
    }

    const bodyResult = await validateBody(req, purgeSchema);
    if (bodyResult instanceof Response) {
      return bodyResult;
    }

    const invalidatedTags: string[] = [];
    const invalidatedPaths: string[] = [];

    if (bodyResult.data.tag) {
      revalidateTag(bodyResult.data.tag, "max");
      invalidatedTags.push(bodyResult.data.tag);
    }

    if (bodyResult.data.key) {
      const path = bodyResult.data.key.startsWith("/")
        ? bodyResult.data.key
        : `/${bodyResult.data.key}`;
      revalidatePath(path);
      invalidatedPaths.push(path);
    }

    if (bodyResult.data.prefix) {
      const normalized = bodyResult.data.prefix.startsWith("/")
        ? bodyResult.data.prefix
        : `/${bodyResult.data.prefix}`;
      revalidatePath(normalized, "layout");
      invalidatedPaths.push(`${normalized}*`);
    }

    return NextResponse.json({
      invalidated: {
        tags: invalidatedTags,
        paths: invalidatedPaths,
      },
    });
  } catch (err) {
    console.error("[cache/purge] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
