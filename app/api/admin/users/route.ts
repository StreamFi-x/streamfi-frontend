import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { verifyAdminSession, adminUnauthorized } from "@/lib/admin-auth";

export async function GET(req: NextRequest): Promise<Response> {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return adminUnauthorized();
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = 20;
  const offset = (page - 1) * limit;
  const q = searchParams.get("q") ?? "";
  const filter = searchParams.get("filter") ?? "all"; // all | banned | live

  try {
    let result;

    if (filter === "banned") {
      if (q) {
        result = await sql`
          SELECT id, username, avatar, email, is_live, is_banned, ban_reason, created_at, total_views
          FROM users
          WHERE is_banned = true
            AND username ILIKE ${"%" + q + "%"}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        result = await sql`
          SELECT id, username, avatar, email, is_live, is_banned, ban_reason, created_at, total_views
          FROM users
          WHERE is_banned = true
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      }
    } else if (filter === "live") {
      if (q) {
        result = await sql`
          SELECT id, username, avatar, email, is_live, is_banned, ban_reason, created_at, total_views
          FROM users
          WHERE is_live = true
            AND username ILIKE ${"%" + q + "%"}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        result = await sql`
          SELECT id, username, avatar, email, is_live, is_banned, ban_reason, created_at, total_views
          FROM users
          WHERE is_live = true
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      }
    } else {
      // all
      if (q) {
        result = await sql`
          SELECT id, username, avatar, email, is_live, is_banned, ban_reason, created_at, total_views
          FROM users
          WHERE username ILIKE ${"%" + q + "%"}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        result = await sql`
          SELECT id, username, avatar, email, is_live, is_banned, ban_reason, created_at, total_views
          FROM users
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      }
    }

    return Response.json({ users: result.rows, page, limit });
  } catch (err) {
    console.error("[admin/users] DB error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
