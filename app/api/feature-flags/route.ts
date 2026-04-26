import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

/**
 * GET /api/feature-flags?keys=clips,gifts
 * Returns flag states for the authenticated user.
 * Pass ?keys= as a comma-separated list to filter; omit for all flags.
 *
 * Resolution order (first match wins):
 *  1. User is in allowed_user_ids → enabled
 *  2. Flag is globally enabled AND user hash falls within rollout_percentage → enabled
 *  3. Otherwise → disabled
 */
export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const { searchParams } = new URL(req.url);
  const keysParam = searchParams.get("keys");
  const keys = keysParam ? keysParam.split(",").map(k => k.trim()).filter(Boolean) : [];

  try {
    const { rows } = keys.length
      ? await sql`
          SELECT key, enabled, rollout_percentage, allowed_user_ids
          FROM feature_flags
          WHERE key = ANY(${keys as unknown as string[]})
        `
      : await sql`SELECT key, enabled, rollout_percentage, allowed_user_ids FROM feature_flags`;

    const userId = session.userId;
    // Simple deterministic hash: sum of char codes mod 100 → 0-99
    const userHash = userId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 100;

    const result: Record<string, boolean> = {};
    for (const row of rows) {
      const inAllowlist = Array.isArray(row.allowed_user_ids) && row.allowed_user_ids.includes(userId);
      const inRollout = row.enabled && userHash < row.rollout_percentage;
      result[row.key] = inAllowlist || inRollout;
    }

    return NextResponse.json({ flags: result });
  } catch (err) {
    console.error("[feature-flags] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch feature flags" }, { status: 500 });
  }
}
