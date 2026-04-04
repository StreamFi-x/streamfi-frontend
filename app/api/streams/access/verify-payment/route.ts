import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import * as StellarSdk from "@stellar/stellar-sdk";
import { getHorizonUrl, getStellarNetwork } from "@/lib/stellar/config";
import { getUsdcAssetConfig } from "@/lib/stellar/usdc";
import { parseStellarAmountToInt } from "@/lib/stellar/amount";

function isValidStellarPublicKey(key: unknown): key is string {
  return typeof key === "string" && /^G[A-Z0-9]{55}$/.test(key);
}

export async function POST(req: NextRequest) {
  try {
    const { streamer_username, viewer_public_key, tx_hash } =
      (await req.json()) as {
        streamer_username?: string;
        viewer_public_key?: string;
        tx_hash?: string;
      };

    if (!streamer_username || !viewer_public_key || !tx_hash) {
      return NextResponse.json(
        {
          error:
            "streamer_username, viewer_public_key, and tx_hash are required",
        },
        { status: 400 }
      );
    }

    if (!isValidStellarPublicKey(viewer_public_key)) {
      return NextResponse.json(
        { error: "Invalid viewer_public_key" },
        { status: 400 }
      );
    }

    // Resolve streamer + access config
    const streamerResult = await sql`
      SELECT id, wallet
      FROM users
      WHERE LOWER(username) = LOWER(${streamer_username})
      LIMIT 1
    `;
    if (streamerResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Streamer not found" },
        { status: 404 }
      );
    }
    const streamerId = streamerResult.rows[0].id as string;
    const streamerWallet = streamerResult.rows[0].wallet as string | null;
    if (!isValidStellarPublicKey(streamerWallet)) {
      return NextResponse.json(
        { error: "Streamer has no valid Stellar wallet configured" },
        { status: 409 }
      );
    }

    const configResult = await sql`
      SELECT access_type, config
      FROM stream_access_config
      WHERE streamer_id = ${streamerId}
      LIMIT 1
    `;
    const accessType = (configResult.rows[0]?.access_type ??
      "public") as string;
    const config = (configResult.rows[0]?.config ?? {}) as Record<
      string,
      unknown
    >;

    if (accessType !== "paid") {
      return NextResponse.json(
        { error: "Stream is not configured as paid" },
        { status: 409 }
      );
    }

    const priceUsdc =
      typeof config.price_usdc === "string" ? config.price_usdc : null;
    if (!priceUsdc) {
      return NextResponse.json(
        { error: "Missing stream price" },
        { status: 500 }
      );
    }

    // Replay protection / idempotency: tx_hash cannot be reused
    const dupe = await sql`
      SELECT id FROM stream_access_grants WHERE tx_hash = ${tx_hash} LIMIT 1
    `;
    if (dupe.rows.length > 0) {
      // Idempotent success: if it's already been granted, treat as OK for retries.
      return NextResponse.json({ ok: true });
    }

    // Resolve viewer user id (must exist to grant)
    const viewerResult = await sql`
      SELECT id FROM users WHERE wallet = ${viewer_public_key} LIMIT 1
    `;
    if (viewerResult.rows.length === 0) {
      return NextResponse.json({ error: "Viewer not found" }, { status: 404 });
    }
    const viewerId = viewerResult.rows[0].id as string;

    // Verify on Stellar Horizon
    const network = getStellarNetwork();
    const server = new StellarSdk.Horizon.Server(getHorizonUrl(network));

    const tx = await server.transactions().transaction(tx_hash).call();

    if (tx.source_account !== viewer_public_key) {
      return NextResponse.json(
        { error: "Transaction source_account mismatch" },
        { status: 400 }
      );
    }

    const expectedMemo = `streamfi-access:${streamerId}`;
    if (tx.memo_type !== "text" || tx.memo !== expectedMemo) {
      return NextResponse.json(
        { error: "Transaction memo mismatch" },
        { status: 400 }
      );
    }

    const ops = await server
      .operations()
      .forTransaction(tx_hash)
      .limit(200)
      .call();
    const payments = ops.records.filter((op: any) => op.type === "payment");
    if (payments.length === 0) {
      return NextResponse.json(
        { error: "No payment operation found" },
        { status: 400 }
      );
    }

    const usdc = getUsdcAssetConfig(network);
    const required = parseStellarAmountToInt(priceUsdc);

    const matching = payments.find((op: any) => {
      if (op.to !== streamerWallet) {
        return false;
      }
      if (op.asset_type !== "credit_alphanum4") {
        return false;
      }
      if (op.asset_code !== usdc.code || op.asset_issuer !== usdc.issuer) {
        return false;
      }
      try {
        return parseStellarAmountToInt(String(op.amount)) >= required;
      } catch {
        return false;
      }
    });

    if (!matching) {
      return NextResponse.json(
        {
          error: "Payment does not match destination/asset/amount requirements",
        },
        { status: 400 }
      );
    }

    // Insert grant
    try {
      await sql`
        INSERT INTO stream_access_grants (streamer_id, viewer_id, access_type, tx_hash, amount_usdc)
        VALUES (${streamerId}, ${viewerId}, 'paid', ${tx_hash}, ${priceUsdc})
      `;
    } catch {
      // If we raced another request, the UNIQUE(tx_hash) or UNIQUE(streamer_id,viewer_id,access_type)
      // will reject. Treat as idempotent success.
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to verify payment" },
      { status: 500 }
    );
  }
}
