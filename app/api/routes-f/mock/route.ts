import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

const SCENARIOS = [
  {
    key: "creator",
    description: "1 creator user with title, category, avatar",
  },
  {
    key: "viewers",
    description: "10 viewer accounts",
  },
  {
    key: "live-stream",
    description: "creator set live with 50 viewers",
  },
  {
    key: "tips",
    description: "20 random testnet tip transactions",
  },
  {
    key: "gifts",
    description: "5 USDC gift transactions",
  },
  {
    key: "recordings",
    description: "3 past recordings",
  },
  {
    key: "full",
    description: "all scenarios in one call",
  },
];

function isMainnet(): boolean {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet";
}

export async function GET(): Promise<Response> {
  if (isMainnet()) {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    );
  }

  return NextResponse.json({ scenarios: SCENARIOS });
}

export async function DELETE(): Promise<Response> {
  if (isMainnet()) {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    );
  }

  await sql`DELETE FROM mock_tip_transactions WHERE mock = true`;
  await sql`DELETE FROM mock_gift_transactions WHERE mock = true`;
  await sql`DELETE FROM stream_recordings WHERE title ILIKE 'Mock %'`;
  await sql`DELETE FROM users WHERE creator->>'mock' = 'true' OR username LIKE 'mock_%'`;

  return NextResponse.json({ ok: true });
}
