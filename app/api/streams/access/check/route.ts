import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { checkTokenGatedAccess } from "@/lib/stream/access";
import type { TokenGateConfig } from "@/types/stream-access";

type AccessType = "public" | "paid" | "password" | "invite" | "token_gated";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parseTokenGateConfig(raw: unknown): TokenGateConfig | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const asset_code =
    typeof o.asset_code === "string"
      ? o.asset_code
      : typeof o.assetCode === "string"
        ? o.assetCode
        : null;
  const min_balance =
    typeof o.min_balance === "string"
      ? o.min_balance
      : typeof o.minBalance === "string"
        ? o.minBalance
        : null;
  if (!asset_code || !min_balance) {
    return null;
  }
  const issuer =
    typeof o.issuer === "string"
      ? o.issuer
      : typeof o.asset_issuer === "string"
        ? o.asset_issuer
        : undefined;
  return { asset_code, min_balance, asset_issuer: issuer };
}

export async function POST(req: NextRequest) {
  try {
    let body: {
      streamer_username?: string;
      streamerUsername?: string;
      viewer_public_key?: string | null;
    };
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }

    const streamer_username =
      body.streamer_username ?? body.streamerUsername ?? undefined;
    const viewer_public_key = body.viewer_public_key ?? null;

    if (!streamer_username || typeof streamer_username !== "string") {
      return jsonError("streamer_username is required", 400);
    }

    const session = await verifySession(req);
    const viewerWallet =
      session.ok && session.wallet
        ? session.wallet
        : typeof viewer_public_key === "string"
          ? viewer_public_key
          : null;

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

    if (configResult.rows.length === 0) {
      return NextResponse.json({
        allowed: true,
        access_type: "public" as const,
      });
    }

    const accessType = configResult.rows[0].access_type as AccessType;
    const config = (configResult.rows[0].config ?? {}) as Record<
      string,
      unknown
    >;

    if (accessType === "public") {
      return NextResponse.json({
        allowed: true,
        access_type: "public" as const,
      });
    }

    if (accessType === "token_gated") {
      const tg = parseTokenGateConfig(config);
      if (!tg) {
        console.warn(
          `[access/check] token_gated misconfigured for ${streamer_username} — allowing`
        );
        return NextResponse.json({ allowed: true, access_type: "token_gated" });
      }

      const result = await checkTokenGatedAccess(tg, viewerWallet);
      if (result.allowed) {
        return NextResponse.json({
          allowed: true,
          access_type: "token_gated" as const,
        });
      }
      return NextResponse.json({
        allowed: false,
        access_type: "token_gated" as const,
        reason: result.reason,
        asset_code: result.asset_code,
        min_balance: result.min_balance,
      });
    }

    if (accessType === "paid") {
      const price_usdc =
        typeof config.price_usdc === "string" ? config.price_usdc : null;

      if (!viewerWallet) {
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
          AND viewer.wallet = ${viewerWallet}
        LIMIT 1
      `;

      if (grantResult.rows.length > 0) {
        return NextResponse.json({
          allowed: true,
          access_type: "paid" as const,
        });
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
