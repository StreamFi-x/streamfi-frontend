import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getStreamHealth } from "@/lib/livepeer/server";

export async function GET(
  req: Request,
  { params }: { params: { wallet: string } }
) {
  try {
    const { wallet } = params;

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet parameter is required" },
        { status: 400 }
      );
    }


    const result = await sql`
      SELECT 
        u.id,
        u.username,
        u.avatar,
        u.bio,
        u.livepeer_stream_id,
        u.playback_id,
        u.streamkey,
        u.is_live,
        u.current_viewers,
        u.total_views,
        u.stream_started_at,
        u.creator,
        u.socialLinks,
        u.created_at,
        -- Get latest session data
        ss.id as session_id,
        ss.started_at as session_started_at,
        ss.peak_viewers,
        ss.total_unique_viewers,
        ss.total_messages,
        ss.avg_bitrate,
        ss.resolution
      FROM users u
      LEFT JOIN stream_sessions ss ON u.id = ss.user_id AND ss.ended_at IS NULL
      WHERE u.wallet = ${wallet}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Stream not found" },
        { status: 404 }
      );
    }

    const streamData = result.rows[0];

    let livepeerHealth = null;
    if (streamData.livepeer_stream_id) {
      try {
        livepeerHealth = await getStreamHealth(streamData.livepeer_stream_id);
      } catch (healthError) {
        console.error("Failed to get Livepeer health:", healthError);
        
      }
    }

    
    const responseData = {
      user: {
        id: streamData.id,
        username: streamData.username,
        avatar: streamData.avatar,
        bio: streamData.bio,
        socialLinks: streamData.socialLinks,
        memberSince: streamData.created_at,
      },
      stream: {
        
        streamId: streamData.livepeer_stream_id,
        playbackId: streamData.playback_id,
        streamKey: streamData.streamkey,
        
        
        isLive: streamData.is_live,
        isConfigured: !!streamData.livepeer_stream_id,
        startedAt: streamData.stream_started_at,
        
        
        title: streamData.creator?.streamTitle || '',
        description: streamData.creator?.description || '',
        category: streamData.creator?.category || '',
        tags: streamData.creator?.tags || [],
        thumbnail: streamData.creator?.thumbnail || '',
        
        
        currentViewers: streamData.current_viewers || 0,
        totalViews: streamData.total_views || 0,
        peakViewers: streamData.peak_viewers || 0,
        
        
        avgBitrate: streamData.avg_bitrate,
        resolution: streamData.resolution,
        
        
        health: livepeerHealth,
      },
      session: streamData.session_id ? {
        id: streamData.session_id,
        startedAt: streamData.session_started_at,
        peakViewers: streamData.peak_viewers,
        totalUniqueViewers: streamData.total_unique_viewers,
        totalMessages: streamData.total_messages,
      } : null,
    };

    return NextResponse.json({ streamData: responseData }, { status: 200 });

  } catch (error) {
    console.error("Get stream error:", error);
    return NextResponse.json(
      { error: "Failed to get stream data" },
      { status: 500 }
    );
  }
}