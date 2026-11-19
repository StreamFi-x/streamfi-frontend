/**
 * GET /api/routes-f/tip-dispute-list
 *
 * List disputes for the authenticated user.
 * - Regular users see their own disputes (as plaintiff)
 * - Admins can list all disputes or filter by status
 *
 * Query parameters:
 * - status?: "open" | "under_review" | "evidence_requested" | "resolved" | "dismissed" | "appealed"
 * - role?: "admin" (admin-only, shows all disputes)
 * - page?: number (default 1, 0-indexed)
 * - limit?: number (default 20, max 100)
 *
 * Response 200:
 *   {
 *     disputes: [
 *       {
 *         id: string,
 *         tx_hash: string,
 *         plaintiff_type: "viewer" | "creator",
 *         reason: string,
 *         amount_disputed: string,
 *         asset_disputed: string,
 *         status: string,
 *         resolution_type?: string,
 *         created_at: string,
 *         resolved_at?: string
 *       }
 *     ],
 *     total: number,
 *     page: number,
 *     limit: number
 *   }
 *
 * Error responses:
 *   401 — unauthorized
 *   500 — database error
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { sql } from "@vercel/postgres";
import { logger } from "@/lib/tracing/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES = [
  "open",
  "under_review",
  "evidence_requested",
  "resolved",
  "dismissed",
  "appealed",
] as const;

const querySchema = z.object({
  status: z.enum(VALID_STATUSES).optional(),
  role: z.enum(["admin"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Check if user is an admin
 */
async function isUserAdmin(user_id: string): Promise<boolean> {
  try {
    const { rows } = await sql`
      SELECT 1 FROM admin_users
      WHERE user_id = ${user_id}::UUID
      LIMIT 1
    `;
    return rows.length > 0;
  } catch (error) {
    logger.warn("[tip-dispute-list] Error checking admin status:", error);
    return false;
  }
}

/**
 * Get user's disputes (as plaintiff)
 */
async function getUserDisputes(
  user_id: string,
  status?: string,
  page = 1,
  limit = 20
): Promise<{ disputes: any[]; total: number }> {
  try {
    const offset = (page - 1) * limit;
    let query = `
      SELECT
        id, tx_hash, plaintiff_type, reason, amount_disputed, asset_disputed,
        status, resolution_type, created_at, resolved_at
      FROM tip_disputes
      WHERE plaintiff_id = $1 AND deleted_at IS NULL
    `;
    const params: any[] = [user_id];

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${
      params.length + 2
    }`;
    params.push(limit, offset);

    const { rows: disputes } = await sql.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as count
      FROM tip_disputes
      WHERE plaintiff_id = $1 AND deleted_at IS NULL
    `;
    const countParams: any[] = [user_id];

    if (status) {
      countQuery += ` AND status = $${countParams.length + 1}`;
      countParams.push(status);
    }

    const { rows: countResult } = await sql.query(countQuery, countParams);
    const total = parseInt(countResult[0]?.count || "0", 10);

    return { disputes, total };
  } catch (error) {
    logger.error("[tip-dispute-list] Error fetching user disputes:", error);
    throw error;
  }
}

/**
 * Get all disputes (admin view)
 */
async function getAllDisputes(
  status?: string,
  page = 1,
  limit = 20
): Promise<{ disputes: any[]; total: number }> {
  try {
    const offset = (page - 1) * limit;
    let query = `
      SELECT
        id, tx_hash, plaintiff_id, plaintiff_type, reason, amount_disputed,
        asset_disputed, status, resolution_type, created_at, resolved_at,
        sender_id, recipient_id
      FROM tip_disputes
      WHERE deleted_at IS NULL
    `;
    const params: any[] = [];

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${
      params.length + 2
    }`;
    params.push(limit, offset);

    const { rows: disputes } = await sql.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM tip_disputes WHERE deleted_at IS NULL`;
    const countParams: any[] = [];

    if (status) {
      countQuery += ` AND status = $${countParams.length + 1}`;
      countParams.push(status);
    }

    const { rows: countResult } = await sql.query(countQuery, countParams);
    const total = parseInt(countResult[0]?.count || "0", 10);

    return { disputes, total };
  } catch (error) {
    logger.error("[tip-dispute-list] Error fetching all disputes:", error);
    throw error;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Verify session
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const parsed = querySchema.safeParse({
      status: searchParams.get("status"),
      role: searchParams.get("role"),
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { status, role, page, limit } = parsed.data;

    // Check admin authorization if role=admin requested
    if (role === "admin") {
      const isAdmin = await isUserAdmin(session.userId);
      if (!isAdmin) {
        logger.warn("[tip-dispute-list] Unauthorized admin access attempt", {
          user_id: session.userId,
        });
        return NextResponse.json(
          { error: "Only admins can view all disputes" },
          { status: 401 }
        );
      }

      const { disputes, total } = await getAllDisputes(status, page, limit);

      return NextResponse.json({
        disputes: disputes.map((d: any) => ({
          id: d.id,
          tx_hash: d.tx_hash,
          plaintiff_id: d.plaintiff_id,
          plaintiff_type: d.plaintiff_type,
          sender_id: d.sender_id,
          recipient_id: d.recipient_id,
          reason: d.reason,
          amount_disputed: d.amount_disputed,
          asset_disputed: d.asset_disputed,
          status: d.status,
          resolution_type: d.resolution_type || null,
          created_at: d.created_at,
          resolved_at: d.resolved_at || null,
        })),
        total,
        page,
        limit,
      });
    }

    // User view: only see their own disputes
    const { disputes, total } = await getUserDisputes(
      session.userId,
      status,
      page,
      limit
    );

    return NextResponse.json({
      disputes: disputes.map((d: any) => ({
        id: d.id,
        tx_hash: d.tx_hash,
        plaintiff_type: d.plaintiff_type,
        reason: d.reason,
        amount_disputed: d.amount_disputed,
        asset_disputed: d.asset_disputed,
        status: d.status,
        resolution_type: d.resolution_type || null,
        created_at: d.created_at,
        resolved_at: d.resolved_at || null,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    logger.error("[tip-dispute-list] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to fetch disputes" },
      { status: 500 }
    );
  }
}
