import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

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
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;

  try {
    await ensureDeviceTable();

    const { rowCount } = await sql`
      DELETE FROM push_notification_devices
      WHERE id = ${id}
        AND user_id = ${session.userId}
    `;

    if ((rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Device unregistered" });
  } catch (error) {
    console.error("[routes-f devices/:id DELETE]", error);
    return NextResponse.json(
      { error: "Failed to unregister device" },
      { status: 500 }
    );
  }
}
