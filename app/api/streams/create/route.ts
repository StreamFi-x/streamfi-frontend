import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { createMuxStream } from "@/lib/mux/server";
import { checkExistingTableDetail } from "@/utils/validators";

export async function POST(req: Request) {
  try {
    const { wallet, title, description, category, tags } = await req.json();

    console.log("🔍 Stream creation request:", {
      wallet,
      title,
      description,
      category,
      tags,
      timestamp: new Date().toISOString(),
    });

    if (!wallet || !title) {
      console.log("❌ Validation failed: missing wallet or title");
      return NextResponse.json(
        { error: "Wallet and title are required" },
        { status: 400 }
      );
    }

    if (title.length > 100) {
      console.log("❌ Validation failed: title too long");
      return NextResponse.json(
        { error: "Title must be 100 characters or less" },
        { status: 400 }
      );
    }

    if (description && description.length > 500) {
      console.log("❌ Validation failed: description too long");
      return NextResponse.json(
        { error: "Description must be 500 characters or less" },
        { status: 400 }
      );
    }

    console.log("🔍 Checking if user exists...");
    const userExists = await checkExistingTableDetail(
      "users",
      "wallet",
      wallet
    );
    if (!userExists) {
      console.log("❌ User not found:", wallet);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    console.log("✅ User found:", wallet);

    console.log("🔍 Fetching user data...");
    const userResult = await sql`
      SELECT id, username, creator, mux_stream_id FROM users WHERE LOWER(wallet) = LOWER(${wallet})
    `;

    if (userResult.rows.length === 0) {
      console.log("❌ User not found in database query");
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];
    console.log("📊 User data:", {
      id: user.id,
      username: user.username,
      hasStream: !!user.mux_stream_id,
      existingStreamId: user.mux_stream_id,
    });

    // PERSISTENT STREAM KEY FLOW: If user already has a stream, return it
    if (user.mux_stream_id) {
      console.log("✅ User already has persistent stream:", user.mux_stream_id);

      // Get additional stream data
      const streamDataResult = await sql`
        SELECT mux_stream_id, mux_playback_id, streamkey, is_live
        FROM users
        WHERE id = ${user.id}
      `;

      const streamData = streamDataResult.rows[0];

      return NextResponse.json(
        {
          message: "Stream already exists",
          streamData: {
            streamId: streamData.mux_stream_id,
            playbackId: streamData.mux_playback_id,
            streamKey: streamData.streamkey,
            rtmpUrl: "rtmp://global-live.mux.com:5222/app",
            title: title,
            isActive: streamData.is_live || false,
            persistent: true,
          },
        },
        { status: 200 }
      );
    }

    if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
      console.log("❌ Missing Mux credentials");
      return NextResponse.json(
        { error: "Mux credentials not configured" },
        { status: 500 }
      );
    }
    console.log("✅ Mux credentials found");

    console.log("🎬 Creating Mux stream...");
    let muxStream;
    try {
      muxStream = await createMuxStream({
        name: `${user.username} - ${title}`,
        record: true,
      });
      console.log("✅ Mux stream created successfully:", {
        id: muxStream?.id,
        playbackId: muxStream?.playbackId,
        hasStreamKey: !!muxStream?.streamKey,
      });
    } catch (muxError) {
      console.error("❌ Mux stream creation failed:", muxError);

      if (muxError instanceof Error) {
        console.error("Mux error details:", {
          message: muxError.message,
          stack: muxError.stack,
          name: muxError.name,
        });
      }

      return NextResponse.json(
        {
          error: "Failed to create Mux stream",
          details:
            muxError instanceof Error ? muxError.message : "Unknown Mux error",
        },
        { status: 500 }
      );
    }

    if (
      !muxStream ||
      !muxStream.id ||
      !muxStream.playbackId ||
      !muxStream.streamKey
    ) {
      console.log("❌ Invalid Mux response:", muxStream);
      return NextResponse.json(
        { error: "Failed to create Mux stream - incomplete response" },
        { status: 500 }
      );
    }

    console.log("🔍 Updating user with Mux data...");
    const updatedCreator = {
      ...user.creator,
      streamTitle: title,
      description: description || "",
      category: category || "",
      tags: tags || [],
      lastUpdated: new Date().toISOString(),
    };

    try {
      await sql`
        UPDATE users SET
          mux_stream_id = ${muxStream.id},
          mux_playback_id = ${muxStream.playbackId},
          streamkey = ${muxStream.streamKey},
          creator = ${JSON.stringify(updatedCreator)},
          updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(wallet) = LOWER(${wallet})
      `;
      console.log("✅ User updated successfully with stream data");
    } catch (dbError) {
      console.error("❌ Database update failed:", dbError);

      console.log("🧹 Attempting to cleanup Mux stream...");
      try {
        // TODO: Add stream cleanup here if needed
        console.log("Stream cleanup would go here");
      } catch (cleanupError) {
        console.error("❌ Cleanup failed:", cleanupError);
      }

      return NextResponse.json(
        {
          error: "Failed to save stream data to database",
          details:
            dbError instanceof Error ? dbError.message : "Database error",
        },
        { status: 500 }
      );
    }

    console.log("🎉 Stream creation completed successfully!");

    return NextResponse.json(
      {
        message: "Stream created successfully",
        streamData: {
          streamId: muxStream.id,
          playbackId: muxStream.playbackId,
          streamKey: muxStream.streamKey,
          rtmpUrl: muxStream.rtmpUrl,
          title: title,
          isActive: muxStream.isActive || false,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ Stream creation error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : "";

    console.log("Error details:", {
      message: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString(),
    });

    if (error instanceof Error) {
      if (error.message.includes("Mux")) {
        return NextResponse.json(
          { error: "Streaming service unavailable. Please try again later." },
          { status: 503 }
        );
      }

      if (error.message.includes("database") || error.message.includes("sql")) {
        return NextResponse.json(
          { error: "Database error. Please try again later." },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Failed to create stream",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
