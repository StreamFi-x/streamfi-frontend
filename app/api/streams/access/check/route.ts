import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

type AccessType = "public" | "paid" | "password" | "invite";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const { streamer_username, viewer_public_key } = (await req.json()) as {
      streamer_username?: string;
      viewer_public_key?: string | null;
    };

    if (!streamer_username) {
      return jsonError("streamer_username is required", 400);
    }

    const streamerResult = await sql`
      SELECT id, wallet
      FROM users
      WHERE LOWER(username) = LOWER(${streamer_username})
      LIMIT 1
    `;
    if (streamerResult.rows.length === 0) {
      return jsonError("Streamer not found", 404);
    }
    const streamerId = streamerResult.rows[0].id as string;
    const streamerWallet = (streamerResult.rows[0].wallet ?? null) as
      | string
      | null;

    const configResult = await sql`
      SELECT access_type, config
      FROM stream_access_config
      WHERE streamer_id = ${streamerId}
      LIMIT 1
    `;

    // Default: public if not configured yet
    if (configResult.rows.length === 0) {
      return NextResponse.json({ allowed: true, access_type: "public" as const });
    }

    const accessType = configResult.rows[0].access_type as AccessType;
    const config = (configResult.rows[0].config ?? {}) as Record<string, unknown>;

    if (accessType === "public") {
      return NextResponse.json({ allowed: true, access_type: "public" as const });
    }

    // Paid access check: grant must exist for this streamer + viewer.
    if (accessType === "paid") {
      const price_usdc = typeof config.price_usdc === "string" ? config.price_usdc : null;

      if (!viewer_public_key) {
        return NextResponse.json({
          allowed: false,
          access_type: "paid" as const,
          reason: "wallet_required" as const,
          price_usdc,
          streamer_id: streamerId,
          streamer_public_key: streamerWallet,
        });
      }

      const grantResult = await sql`
        SELECT g.id
        FROM stream_access_grants g
        JOIN users viewer ON viewer.id = g.viewer_id
        WHERE g.streamer_id = ${streamerId}
          AND g.access_type = 'paid'
          AND viewer.wallet = ${viewer_public_key}
        LIMIT 1
      `;

      if (grantResult.rows.length > 0) {
        return NextResponse.json({ allowed: true, access_type: "paid" as const });
      }

      return NextResponse.json({
        allowed: false,
        access_type: "paid" as const,
        reason: "paid" as const,
        price_usdc,
        streamer_id: streamerId,
        streamer_public_key: streamerWallet,
      });
    }

    // Other access types will be implemented in #373/#374. For now, deny with reason.
    return NextResponse.json({
      allowed: false,
      access_type: accessType,
      reason: accessType,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to check access" },
      { status: 500 }
    );
  }
}

