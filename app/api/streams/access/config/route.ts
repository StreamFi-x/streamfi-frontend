import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

type AccessType = "public" | "paid" | "password" | "invite";

function isValidPrice(price: unknown): price is string {
  return (
    typeof price === "string" &&
    /^\d+(\.\d{1,2})?$/.test(price) &&
    Number(price) >= 1 &&
    Number(price) <= 999
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    if (!wallet) {
      return NextResponse.json(
        { error: "wallet is required" },
        { status: 400 }
      );
    }

    const streamer = await sql`
      SELECT id FROM users WHERE wallet = ${wallet} LIMIT 1
    `;
    if (streamer.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const streamerId = streamer.rows[0].id as string;

    const configRes = await sql`
      SELECT access_type, config
      FROM stream_access_config
      WHERE streamer_id = ${streamerId}
      LIMIT 1
    `;

    const access_type = (configRes.rows[0]?.access_type ??
      "public") as AccessType;
    const config = (configRes.rows[0]?.config ?? {}) as Record<string, unknown>;

    const price_usdc =
      typeof config.price_usdc === "string" ? config.price_usdc : null;

    const paidStats = await sql`
      SELECT
        COUNT(*)::int AS paid_viewers,
        COALESCE(SUM(NULLIF(amount_usdc, '')::numeric), 0)::text AS earned_usdc
      FROM stream_access_grants
      WHERE streamer_id = ${streamerId}
        AND access_type = 'paid'
    `;

    return NextResponse.json({
      access_type,
      config: { price_usdc },
      stats: paidStats.rows[0] ?? { paid_viewers: 0, earned_usdc: "0" },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Failed to fetch access config",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { wallet, access_type, price_usdc } = (await req.json()) as {
      wallet?: string;
      access_type?: AccessType;
      price_usdc?: string;
    };

    if (!wallet) {
      return NextResponse.json(
        { error: "wallet is required" },
        { status: 400 }
      );
    }

    if (!access_type || !["public", "paid"].includes(access_type)) {
      return NextResponse.json(
        { error: "access_type must be 'public' or 'paid'" },
        { status: 400 }
      );
    }

    const streamer = await sql`
      SELECT id FROM users WHERE wallet = ${wallet} LIMIT 1
    `;
    if (streamer.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const streamerId = streamer.rows[0].id as string;

    const config =
      access_type === "paid"
        ? (() => {
            if (!isValidPrice(price_usdc)) {
              throw new Error(
                "price_usdc must be between 1 and 999 (2 decimals max)"
              );
            }
            return { price_usdc };
          })()
        : {};

    await sql`
      INSERT INTO stream_access_config (streamer_id, access_type, config, updated_at)
      VALUES (${streamerId}, ${access_type}, ${JSON.stringify(config)}, CURRENT_TIMESTAMP)
      ON CONFLICT (streamer_id) DO UPDATE SET
        access_type = EXCLUDED.access_type,
        config = EXCLUDED.config,
        updated_at = CURRENT_TIMESTAMP
    `;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Failed to update access config",
      },
      { status: 500 }
    );
  }
}
