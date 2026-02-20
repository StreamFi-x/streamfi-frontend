import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

/**
 * One-time migration to bring chat_messages and stream_sessions up to the
 * schema expected by /api/streams/chat after the Mux migration.
 *
 * Safe to run multiple times — every operation uses IF (NOT) EXISTS / DO NOTHING.
 *
 * Hit GET /api/debug/migrate-chat to run.
 */
export async function GET() {
  const done: string[] = [];
  const skipped: string[] = [];

  try {
    // ─── 1. Inspect current chat_messages columns ────────────────────────────
    const chatCols = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'chat_messages'
    `;
    const chatColNames = chatCols.rows.map(r => r.column_name as string);

    // ─── 2. Rename message → content ────────────────────────────────────────
    if (chatColNames.includes("message") && !chatColNames.includes("content")) {
      await sql`ALTER TABLE chat_messages RENAME COLUMN message TO content`;
      done.push("✅ Renamed chat_messages.message → content");
    } else if (chatColNames.includes("content")) {
      skipped.push("⏭️ chat_messages.content already exists");
    } else {
      // Neither exists — add content fresh
      await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT ''`;
      done.push("✅ Added chat_messages.content column");
    }

    // ─── 3. Rename timestamp → created_at ───────────────────────────────────
    if (
      chatColNames.includes("timestamp") &&
      !chatColNames.includes("created_at")
    ) {
      await sql`ALTER TABLE chat_messages RENAME COLUMN "timestamp" TO created_at`;
      done.push("✅ Renamed chat_messages.timestamp → created_at");
    } else if (chatColNames.includes("created_at")) {
      skipped.push("⏭️ chat_messages.created_at already exists");
    } else {
      await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`;
      done.push("✅ Added chat_messages.created_at column");
    }

    // ─── 4. Add is_moderated ─────────────────────────────────────────────────
    await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_moderated BOOLEAN DEFAULT FALSE`;
    done.push("✅ Ensured chat_messages.is_moderated exists");

    // ─── 5. Add moderated_by ─────────────────────────────────────────────────
    await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES users(id) ON DELETE SET NULL`;
    done.push("✅ Ensured chat_messages.moderated_by exists");

    // ─── 6. Fix message_type default ('text' → 'message') ───────────────────
    await sql`
      ALTER TABLE chat_messages
        ALTER COLUMN message_type SET DEFAULT 'message'
    `;
    done.push("✅ Updated chat_messages.message_type default to 'message'");

    // ─── 7. Inspect current stream_sessions columns ──────────────────────────
    const sessionCols = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'stream_sessions'
    `;
    const sessionColNames = sessionCols.rows.map(r => r.column_name as string);

    // ─── 8. Drop NOT NULL on livepeer_stream_id (blocks Mux inserts) ─────────
    if (sessionColNames.includes("livepeer_stream_id")) {
      await sql`
        ALTER TABLE stream_sessions
          ALTER COLUMN livepeer_stream_id DROP NOT NULL
      `;
      done.push("✅ Dropped NOT NULL from stream_sessions.livepeer_stream_id");
    } else {
      skipped.push("⏭️ stream_sessions.livepeer_stream_id not present");
    }

    // ─── 9. Add mux_session_id ───────────────────────────────────────────────
    await sql`ALTER TABLE stream_sessions ADD COLUMN IF NOT EXISTS mux_session_id VARCHAR(255)`;
    done.push("✅ Ensured stream_sessions.mux_session_id exists");

    // ─── 10. Add total_messages ──────────────────────────────────────────────
    await sql`ALTER TABLE stream_sessions ADD COLUMN IF NOT EXISTS total_messages INTEGER DEFAULT 0`;
    done.push("✅ Ensured stream_sessions.total_messages exists");

    // ─── 10b. Add avg_bitrate ──────────────────────────────────────────────
    await sql`ALTER TABLE stream_sessions ADD COLUMN IF NOT EXISTS avg_bitrate REAL`;
    done.push("✅ Ensured stream_sessions.avg_bitrate exists");

    // ─── 10c. Add resolution ───────────────────────────────────────────────
    await sql`ALTER TABLE stream_sessions ADD COLUMN IF NOT EXISTS resolution VARCHAR(50)`;
    done.push("✅ Ensured stream_sessions.resolution exists");

    // ─── 11. Add mux_playback_id to users (in case missing) ─────────────────
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS mux_playback_id VARCHAR(255)`;
    done.push("✅ Ensured users.mux_playback_id exists");

    // ─── 12. Add mux_stream_id to users (in case missing) ───────────────────
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS mux_stream_id VARCHAR(255)`;
    done.push("✅ Ensured users.mux_stream_id exists");

    // ─── 13. Useful indexes ──────────────────────────────────────────────────
    await sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(stream_session_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_stream_sessions_user ON stream_sessions(user_id)`;
    done.push("✅ Ensured chat indexes exist");

    // ─── Final state ─────────────────────────────────────────────────────────
    const finalChatCols = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'chat_messages'
      ORDER BY ordinal_position
    `;
    const finalSessionCols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'stream_sessions'
      ORDER BY ordinal_position
    `;

    return NextResponse.json({
      success: true,
      message: `Migration complete — ${done.length} changes applied, ${skipped.length} already correct.`,
      changes: done,
      skipped,
      final_schema: {
        chat_messages: finalChatCols.rows,
        stream_sessions: finalSessionCols.rows,
      },
    });
  } catch (error) {
    console.error("❌ Migration error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        changes_so_far: done,
      },
      { status: 500 }
    );
  }
}
