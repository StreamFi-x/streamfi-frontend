import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isValidAssetCode, isValidStellarIssuer } from "@/lib/stream/access";
import type { StreamAccessType, TokenGateConfig } from "@/types/stream-access";

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { email, creator, stream_access_type, stream_access_config } = body;

    if (!email || !creator) {
      return NextResponse.json(
        { error: "Email and creator data are required" },
        { status: 400 }
      );
    }

    const {
      streamTitle = "",
      tags = [],
      category = "",
      payout = "",
      thumbnail = "",
    } = creator;

    const updatedCreator = { streamTitle, tags, category, payout, thumbnail };

    // ── Access control validation ───────────────────────────────────────────
    const accessType: StreamAccessType = stream_access_type ?? "public";
    if (accessType !== "public" && accessType !== "token_gated") {
      return NextResponse.json(
        {
          error:
            "Invalid stream_access_type. Must be 'public' or 'token_gated'.",
        },
        { status: 400 }
      );
    }

    let accessConfig: TokenGateConfig | null = null;

    if (accessType === "token_gated") {
      const cfg = stream_access_config as Partial<TokenGateConfig> | undefined;

      if (!cfg?.asset_code || !cfg?.asset_issuer) {
        return NextResponse.json(
          {
            error:
              "stream_access_config.asset_code and stream_access_config.asset_issuer are required for token_gated streams.",
          },
          { status: 400 }
        );
      }

      if (!isValidAssetCode(cfg.asset_code)) {
        return NextResponse.json(
          {
            error: "Invalid asset_code. Must be 1–12 alphanumeric characters.",
          },
          { status: 400 }
        );
      }

      if (!isValidStellarIssuer(cfg.asset_issuer)) {
        return NextResponse.json(
          {
            error:
              "Invalid asset_issuer. Must be a valid Stellar public key (starts with G, 56 chars).",
          },
          { status: 400 }
        );
      }

      const minBalance = cfg.min_balance ?? "1";
      if (isNaN(parseFloat(minBalance)) || parseFloat(minBalance) <= 0) {
        return NextResponse.json(
          { error: "min_balance must be a positive number." },
          { status: 400 }
        );
      }

      accessConfig = {
        asset_code: cfg.asset_code,
        asset_issuer: cfg.asset_issuer,
        min_balance: minBalance,
      };
    }

    const result = await sql`
      UPDATE users
      SET
        creator              = ${JSON.stringify(updatedCreator)},
        stream_access_type   = ${accessType},
        stream_access_config = ${accessConfig ? JSON.stringify(accessConfig) : null},
        updated_at           = CURRENT_TIMESTAMP
      WHERE email = ${email}
    `;

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Creator info updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating creator info:", error);
    return NextResponse.json(
      { error: "Failed to update creator info" },
      { status: 500 }
    );
  }
}
