import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";


export async function POST(req: Request) {
  try {
    const { playbackId, sessionId, userId } = await req.json();

    if (!playbackId || !sessionId) {
      return NextResponse.json(
        { error: "Playback ID and session ID are required" },
        { status: 400 }
      );
    }

    
    const streamResult = await sql`
      SELECT id, username, is_live, current_viewers
      FROM users 
      WHERE playback_id = ${playbackId}
    `;

    if (streamResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Stream not found" },
        { status: 404 }
      );
    }

    const stream = streamResult.rows[0];

    if (!stream.is_live) {
      return NextResponse.json(
        { error: "Stream is not currently live" },
        { status: 409 }
      );
    }

    
    const sessionResult = await sql`
      SELECT id FROM stream_sessions
      WHERE user_id = ${stream.id} AND ended_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
    `;

    if (sessionResult.rows.length === 0) {
      return NextResponse.json(
        { error: "No active stream session found" },
        { status: 404 }
      );
    }

    const streamSession = sessionResult.rows[0];

    
    const existingViewer = await sql`
      SELECT id FROM stream_viewers
      WHERE session_id = ${sessionId} AND left_at IS NULL
    `;

    if (existingViewer.rows.length > 0) {
      return NextResponse.json(
        { message: "Already tracking this viewer" },
        { status: 200 }
      );
    }

    
    await sql`
      INSERT INTO stream_viewers (
        stream_session_id, 
        user_id, 
        session_id,
        joined_at
      )
      VALUES (${streamSession.id}, ${userId || null}, ${sessionId}, CURRENT_TIMESTAMP)
    `;

    
    const newViewerCount = stream.current_viewers + 1;
    
    await sql`
      UPDATE users SET
        current_viewers = ${newViewerCount},
        total_views = total_views + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${stream.id}
    `;

    await sql`
      UPDATE stream_sessions SET
        peak_viewers = GREATEST(peak_viewers, ${newViewerCount}),
        total_unique_viewers = total_unique_viewers + 1
      WHERE id = ${streamSession.id}
    `;

    return NextResponse.json(
      { 
        message: "Viewer joined successfully",
        currentViewers: newViewerCount,
        streamInfo: {
          username: stream.username,
          isLive: stream.is_live,
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Viewer join error:", error);
    return NextResponse.json(
      { error: "Failed to join stream" },
      { status: 500 }
    );
  }
}


export async function DELETE(req: Request) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }
    const viewerResult = await sql`
      UPDATE stream_viewers SET
        left_at = CURRENT_TIMESTAMP
      WHERE session_id = ${sessionId} AND left_at IS NULL
      RETURNING stream_session_id
    `;

    if (viewerResult.rows.length === 0) {
      return NextResponse.json(
        { message: "Viewer session not found or already ended" },
        { status: 200 }
      );
    }

    const streamSessionId = viewerResult.rows[0].stream_session_id;

    
    const sessionResult = await sql`
      SELECT user_id FROM stream_sessions
      WHERE id = ${streamSessionId}
    `;

    if (sessionResult.rows.length > 0) {
      const userId = sessionResult.rows[0].user_id;

      
      await sql`
        UPDATE users SET
          current_viewers = GREATEST(current_viewers - 1, 0),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userId}
      `;
    }

    return NextResponse.json(
      { message: "Viewer left successfully" },
      { status: 200 }
    );

  } catch (error) {
    console.error("Viewer leave error:", error);
    return NextResponse.json(
      { error: "Failed to leave stream" },
      { status: 500 }
    );
  }
}