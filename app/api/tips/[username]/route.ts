import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import {
  apiBadRequest,
  apiInternalError,
  apiNotFound,
  apiSuccess,
} from "@/lib/api";
import { logger } from "@/lib/tracing/logger";

interface RouteContext {
  params: Promise<{ username: string }> | { username: string };
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const resolvedParams = await context.params;
    const username = resolvedParams?.username?.trim();

    if (!username) {
      return apiBadRequest("Username is required");
    }

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10)),
      100
    );

    // 1. Fetch user by username
    const userResult = await sql`
      SELECT id, username, wallet, total_tips_received, total_tips_count
      FROM users
      WHERE LOWER(username) = LOWER(${username}) AND deleted_at IS NULL
      LIMIT 1
    `;

    if (userResult.rows.length === 0) {
      return apiNotFound("User not found");
    }

    const user = userResult.rows[0];

    // 2. Fetch paginated tips from tip_transactions
    let tips: Array<{
      id: string;
      sender: string;
      senderUsername?: string;
      amount: string;
      asset: string;
      txHash: string;
      timestamp: string;
    }> = [];
    let nextCursor: string | null = null;

    try {
      const fetchLimit = limit + 1;
      const tipsResult = cursor
        ? await sql`
            SELECT 
              tt.id,
              tt.amount_xlm,
              tt.tx_hash,
              tt.created_at,
              COALESCE(u.wallet, '') AS sender_wallet,
              u.username AS sender_username
            FROM tip_transactions tt
            LEFT JOIN users u ON tt.supporter_id = u.id AND u.deleted_at IS NULL
            WHERE tt.creator_id = ${user.id}
              AND tt.created_at < (SELECT created_at FROM tip_transactions WHERE id = ${cursor} LIMIT 1)
            ORDER BY tt.created_at DESC
            LIMIT ${fetchLimit}
          `
        : await sql`
            SELECT 
              tt.id,
              tt.amount_xlm,
              tt.tx_hash,
              tt.created_at,
              COALESCE(u.wallet, '') AS sender_wallet,
              u.username AS sender_username
            FROM tip_transactions tt
            LEFT JOIN users u ON tt.supporter_id = u.id AND u.deleted_at IS NULL
            WHERE tt.creator_id = ${user.id}
            ORDER BY tt.created_at DESC
            LIMIT ${fetchLimit}
          `;

      const rows = tipsResult.rows;
      const hasMore = rows.length > limit;
      const pageRows = hasMore ? rows.slice(0, limit) : rows;

      tips = pageRows.map(row => ({
        id: String(row.id),
        sender: row.sender_wallet || "Unknown",
        senderUsername: row.sender_username || undefined,
        amount: String(row.amount_xlm ?? "0"),
        asset: "XLM",
        txHash: row.tx_hash || "",
        timestamp: row.created_at
          ? new Date(row.created_at).toISOString()
          : new Date().toISOString(),
      }));

      if (hasMore && pageRows.length > 0) {
        nextCursor = String(pageRows[pageRows.length - 1].id);
      }
    } catch (dbError) {
      logger.warn("tip_transactions lookup failed or table empty", {
        route: "GET /api/tips/[username]",
        username,
        error: dbError instanceof Error ? dbError.message : String(dbError),
      });
      // Return empty tips list with user totals intact
    }

    return apiSuccess(
      {
        tips,
        pagination: {
          nextCursor,
        },
        total: {
          received: String(user.total_tips_received ?? "0"),
          count: Number(user.total_tips_count ?? 0),
        },
      },
      { legacyFlat: true }
    );
  } catch (error) {
    logger.error("Failed to fetch tip history", error, {
      route: "GET /api/tips/[username]",
    });
    return apiInternalError("Failed to fetch tip history");
  }
}
