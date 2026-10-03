/**
 * POST /api/routes-f/stream/extensions/[id]/kill-switch
 *
 * Emergency kill-switch allowing creators or platform admins to immediately
 * disable and terminate execution of an extension without requiring author cooperation.
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";
import { publishRealtimeMessage } from "@/lib/realtime/pubsub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { id } = await context.params;

  try {
    const { rows: existing } = await sql`
      SELECT se.id, se.user_id, se.extension_id, ec.name, u.mux_playback_id
      FROM stream_extensions se
      JOIN extension_catalog ec ON se.extension_id = ec.id
      JOIN users u ON se.user_id = u.id
      WHERE se.id = ${id}
      LIMIT 1
    `;

    if (existing.length === 0) {
      return NextResponse.json({ error: "Extension not found" }, { status: 404 });
    }

    const ext = existing[0];
    if (ext.user_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Force disable immediately
    await sql`
      UPDATE stream_extensions
      SET is_enabled = FALSE, updated_at = NOW()
      WHERE id = ${id}
    `;

    // Broadcast kill-switch event to any active overlay frames
    if (ext.mux_playback_id) {
      publishRealtimeMessage(
        `stream:${ext.mux_playback_id}:overlay`,
        "extension:kill",
        { extensionId: id, name: ext.name }
      ).catch((e) => console.error("[kill-switch] Broadcast error:", e));
    }

    return NextResponse.json({
      ok: true,
      message: `Extension '${ext.name}' has been terminated and disabled.`,
    });
  } catch (err) {
    console.error("[Extensions kill-switch] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
