import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

function isMainnet(): boolean {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet";
}

function randomWallet(seed: number): string {
  const base = `GMOCKWALLET${seed.toString().padStart(4, "0")}`;
  return (base + "A".repeat(56)).slice(0, 56);
}

async function ensureCreator(): Promise<{ id: string; username: string }> {
  const username = "mock_testcreator";
  const email = "mock_testcreator@streamfi.dev";
  const wallet = randomWallet(1);

  const { rows } = await sql`
    INSERT INTO users (username, email, wallet, avatar, creator)
    VALUES (
      ${username},
      ${email},
      ${wallet},
      '/Images/streamer.jpg',
      ${JSON.stringify({
        streamTitle: "Mock Creator Live",
        category: "Gaming",
        mock: true,
      })}::jsonb
    )
    ON CONFLICT (username)
    DO UPDATE SET creator = users.creator || ${JSON.stringify({ mock: true })}::jsonb
    RETURNING id, username
  `;

  return rows[0] as { id: string; username: string };
}

async function seedViewers(): Promise<number> {
  let created = 0;
  for (let i = 1; i <= 10; i += 1) {
    const username = `mock_testviewer${i}`;
    const email = `${username}@streamfi.dev`;
    const wallet = randomWallet(100 + i);

    const result = await sql`
      INSERT INTO users (username, email, wallet, creator)
      VALUES (
        ${username},
        ${email},
        ${wallet},
        ${JSON.stringify({ mock: true })}::jsonb
      )
      ON CONFLICT (username) DO NOTHING
      RETURNING id
    `;

    if (result.rows.length > 0) {
      created += 1;
    }
  }
  return created;
}

async function seedLiveStream(): Promise<void> {
  const creator = await ensureCreator();
  await sql`
    UPDATE users
    SET
      is_live = true,
      current_viewers = 50,
      stream_started_at = now() - interval '15 minutes'
    WHERE id = ${creator.id}
  `;
}

async function seedTips(creatorId: string): Promise<number> {
  let created = 0;
  for (let i = 0; i < 20; i += 1) {
    const amount = Number((Math.random() * 5 + 0.2).toFixed(7));
    const txHash = `mock-tip-${Date.now()}-${i}`;
    await sql`
      INSERT INTO mock_tip_transactions (creator_id, amount_xlm, tx_hash, mock)
      VALUES (${creatorId}, ${amount}, ${txHash}, true)
    `;
    created += 1;
  }
  return created;
}

async function seedGifts(creatorId: string): Promise<number> {
  const tiers = ["bronze", "silver", "gold", "silver", "gold"];
  let created = 0;
  for (let i = 0; i < tiers.length; i += 1) {
    const txHash = `mock-gift-${Date.now()}-${i}`;
    const amount = tiers[i] === "gold" ? 25 : tiers[i] === "silver" ? 10 : 3;
    await sql`
      INSERT INTO mock_gift_transactions (creator_id, tier, amount_usdc, tx_hash, mock)
      VALUES (${creatorId}, ${tiers[i]}, ${amount}, ${txHash}, true)
    `;
    created += 1;
  }
  return created;
}

async function seedRecordings(creatorId: string): Promise<number> {
  let created = 0;
  for (let i = 0; i < 3; i += 1) {
    const playbackId = `mock-playback-${Date.now()}-${i}`;
    const assetId = `mock-asset-${Date.now()}-${i}`;
    await sql`
      INSERT INTO stream_recordings (
        user_id,
        mux_asset_id,
        playback_id,
        title,
        duration,
        status
      )
      VALUES (
        ${creatorId},
        ${assetId},
        ${playbackId},
        ${`Mock Recording ${i + 1}`},
        ${1800 + i * 420},
        'ready'
      )
      ON CONFLICT (mux_asset_id) DO NOTHING
    `;
    created += 1;
  }
  return created;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ scenario: string }> }
): Promise<Response> {
  if (isMainnet()) {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    );
  }

  const { scenario } = await params;
  const creator = await ensureCreator();

  const created = {
    creators: 0,
    viewers: 0,
    tips: 0,
    gifts: 0,
    recordings: 0,
  };

  if (scenario === "creator" || scenario === "full") {
    created.creators = 1;
  }

  if (scenario === "viewers" || scenario === "full") {
    created.viewers = await seedViewers();
  }

  if (scenario === "live-stream" || scenario === "full") {
    await seedLiveStream();
  }

  if (scenario === "tips" || scenario === "full") {
    created.tips = await seedTips(creator.id);
  }

  if (scenario === "gifts" || scenario === "full") {
    created.gifts = await seedGifts(creator.id);
  }

  if (scenario === "recordings" || scenario === "full") {
    created.recordings = await seedRecordings(creator.id);
  }

  const known = new Set([
    "creator",
    "viewers",
    "live-stream",
    "tips",
    "gifts",
    "recordings",
    "full",
  ]);

  if (!known.has(scenario)) {
    return NextResponse.json({ error: "Unknown scenario" }, { status: 404 });
  }

  return NextResponse.json({
    created,
    credentials: {
      creator: { username: "mock_testcreator", password: "test1234" },
      viewer: { username: "mock_testviewer1", password: "test1234" },
    },
    stellar: {
      network: "testnet",
      funding: "simulated friendbot funding for mock environment",
      tx_mode: "mock transaction hashes generated",
    },
  });
}
