import { createCipheriv, createHash, createHmac, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const platformSchema = z.enum(["web", "ios", "android"]);

const registerDeviceSchema = z.object({
  token: z.string().min(8).max(4096),
  platform: platformSchema,
  name: z.string().trim().min(1).max(80).optional(),
});

const MAX_DEVICES_PER_USER = 5;

function resolveEncryptionKey(): Buffer {
  const raw =
    process.env.PUSH_TOKEN_ENCRYPTION_KEY ??
    process.env.STELLAR_ENCRYPTION_KEY ??
    process.env.SESSION_SECRET;

  if (!raw) {
    throw new Error(
      "Missing PUSH_TOKEN_ENCRYPTION_KEY (or STELLAR_ENCRYPTION_KEY / SESSION_SECRET fallback)"
    );
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  return createHash("sha256").update(raw).digest();
}

function encryptToken(token: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    token_ciphertext: ciphertext.toString("base64"),
    token_iv: iv.toString("base64"),
    token_tag: tag.toString("base64"),
  };
}

function hashToken(token: string, key: Buffer): string {
  return createHmac("sha256", key).update(token).digest("hex");
}

async function ensureDeviceTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS push_notification_devices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      token_ciphertext TEXT NOT NULL,
      token_iv TEXT NOT NULL,
      token_tag TEXT NOT NULL,
      platform TEXT NOT NULL CHECK (platform IN ('web', 'ios', 'android')),
      name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_push_devices_user_updated
    ON push_notification_devices (user_id, updated_at DESC)
  `;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensureDeviceTable();

    const { rows } = await sql`
      SELECT id, platform, name, created_at, updated_at, last_seen_at
      FROM push_notification_devices
      WHERE user_id = ${session.userId}
      ORDER BY updated_at DESC
      LIMIT ${MAX_DEVICES_PER_USER}
    `;

    return NextResponse.json({ devices: rows });
  } catch (error) {
    console.error("[routes-f devices GET]", error);
    return NextResponse.json(
      { error: "Failed to list registered devices" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, registerDeviceSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { token, platform, name } = bodyResult.data;

  try {
    await ensureDeviceTable();

    const key = resolveEncryptionKey();
    const tokenHash = hashToken(token, key);

    const { rows: existingRows } = await sql`
      SELECT id, user_id
      FROM push_notification_devices
      WHERE token_hash = ${tokenHash}
      LIMIT 1
    `;

    const existing = existingRows[0];
    const isNewToken = !existing;

    if (isNewToken) {
      const { rows: countRows } = await sql`
        SELECT COUNT(*)::int AS total
        FROM push_notification_devices
        WHERE user_id = ${session.userId}
      `;

      const total = Number(countRows[0]?.total ?? 0);
      if (total >= MAX_DEVICES_PER_USER) {
        return NextResponse.json(
          { error: "Device limit reached (max 5)" },
          { status: 400 }
        );
      }
    }

    const encrypted = encryptToken(token, key);

    const { rows } = await sql`
      INSERT INTO push_notification_devices (
        user_id,
        token_hash,
        token_ciphertext,
        token_iv,
        token_tag,
        platform,
        name,
        updated_at,
        last_seen_at
      )
      VALUES (
        ${session.userId},
        ${tokenHash},
        ${encrypted.token_ciphertext},
        ${encrypted.token_iv},
        ${encrypted.token_tag},
        ${platform},
        ${name ?? null},
        NOW(),
        NOW()
      )
      ON CONFLICT (token_hash) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        token_ciphertext = EXCLUDED.token_ciphertext,
        token_iv = EXCLUDED.token_iv,
        token_tag = EXCLUDED.token_tag,
        platform = EXCLUDED.platform,
        name = EXCLUDED.name,
        updated_at = NOW(),
        last_seen_at = NOW()
      RETURNING id, user_id, platform, name, created_at, updated_at, last_seen_at
    `;

    return NextResponse.json(
      {
        device: rows[0],
        upserted: true,
      },
      { status: isNewToken ? 201 : 200 }
    );
  } catch (error) {
    console.error("[routes-f devices POST]", error);
    return NextResponse.json(
      { error: "Failed to register push device" },
      { status: 500 }
    );
  }
}
