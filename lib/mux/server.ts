import Mux from "@mux/mux-node";

// Check if Mux credentials are configured
if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
  console.error("⚠️ Mux credentials not configured!");
  console.error("MUX_TOKEN_ID present:", !!process.env.MUX_TOKEN_ID);
  console.error("MUX_TOKEN_SECRET present:", !!process.env.MUX_TOKEN_SECRET);
}

// Initialize Mux client
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

export interface MuxStreamData {
  id: string;
  streamKey: string;
  playbackId: string;
  status: string;
  rtmpUrl: string;
  isActive?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function createMuxStream(_streamData?: {
  name: string;
  record?: boolean;
}) {
  try {
    const liveStream = await mux.video.liveStreams.create({
      playback_policy: ["public"],
      new_asset_settings: {
        playback_policy: ["public"],
      },
      reconnect_window: 60, // Allow reconnection within 60 seconds
      latency_mode: "low", // Low-latency streaming (~3-5s delay)
      max_continuous_duration: 43200, // 12 hours max
    });

    // Get the playback ID from the created stream
    const playbackId = liveStream.playback_ids?.[0]?.id || "";

    return {
      id: liveStream.id,
      streamKey: liveStream.stream_key || "",
      playbackId,
      status: liveStream.status || "idle",
      rtmpUrl: "rtmp://global-live.mux.com:5222/app",
      isActive: liveStream.status === "active",
    };
  } catch (error: any) {
    console.error("❌ Mux stream creation error:", error);
    console.error("Error details:", {
      message: error?.message,
      response: error?.response?.data,
      status: error?.response?.status,
    });
    throw new Error(`Failed to create Mux stream: ${error?.message || error}`);
  }
}

export async function getMuxStream(streamId: string) {
  try {
    const liveStream = await mux.video.liveStreams.retrieve(streamId);

    return {
      id: liveStream.id,
      streamKey: liveStream.stream_key || "",
      playbackId: liveStream.playback_ids?.[0]?.id || "",
      status: liveStream.status || "idle",
      rtmpUrl: "rtmp://global-live.mux.com:5222/app",
      isActive: liveStream.status === "active",
    };
  } catch (error) {
    console.error("Mux stream retrieval error:", error);
    throw new Error("Failed to retrieve Mux stream");
  }
}

export async function deleteMuxStream(streamId: string) {
  try {
    await mux.video.liveStreams.delete(streamId);
    return true;
  } catch (error) {
    console.error("Mux stream deletion error:", error);
    throw new Error("Failed to delete Mux stream");
  }
}

export async function getMuxStreamMetrics(streamId: string) {
  try {
    const liveStream = await mux.video.liveStreams.retrieve(streamId);

    return {
      streamId: liveStream.id,
      status: liveStream.status || "idle",
      isActive: liveStream.status === "active",
      createdAt: liveStream.created_at,
      reconnectWindow: liveStream.reconnect_window,
      latencyMode: liveStream.latency_mode,
    };
  } catch (error) {
    console.error("Mux metrics error:", error);
    throw new Error("Failed to get stream metrics");
  }
}

export async function getPlaybackUrl(playbackId: string) {
  try {
    // Mux HLS playback URL format
    return `https://stream.mux.com/${playbackId}.m3u8`;
  } catch (error) {
    console.error("Mux playback URL error:", error);
    throw new Error("Failed to get playback URL");
  }
}

export async function enableMuxStreamRecording(streamId: string) {
  try {
    // Mux automatically creates assets when new_asset_settings is configured
    // during stream creation, so recording is handled automatically
    const liveStream = await mux.video.liveStreams.retrieve(streamId);
    return {
      recordingEnabled: !!liveStream.new_asset_settings,
      streamId: liveStream.id,
    };
  } catch (error) {
    console.error("Mux recording check error:", error);
    throw new Error("Failed to check recording status");
  }
}

export async function createMuxSignedUrl(
  playbackId: string,
  type: "video" | "thumbnail" = "video"
) {
  try {
    // For public playback IDs, no signing is needed
    // For private/signed playback, you would use JWT signing here
    if (type === "thumbnail") {
      return `https://image.mux.com/${playbackId}/thumbnail.jpg`;
    }
    return `https://stream.mux.com/${playbackId}.m3u8`;
  } catch (error) {
    console.error("Mux signed URL error:", error);
    throw new Error("Failed to create signed URL");
  }
}

export async function getMuxAsset(assetId: string) {
  try {
    const asset = await mux.video.assets.retrieve(assetId);
    return {
      id: asset.id,
      status: asset.status,
      duration: asset.duration,
      playbackIds: asset.playback_ids,
      createdAt: asset.created_at,
    };
  } catch (error) {
    console.error("Mux asset retrieval error:", error);
    throw new Error("Failed to retrieve Mux asset");
  }
}

export async function disableMuxStream(streamId: string) {
  try {
    await mux.video.liveStreams.disable(streamId);
    return { success: true, streamId };
  } catch (error) {
    console.error("Mux stream disable error:", error);
    throw new Error("Failed to disable Mux stream");
  }
}

export async function enableMuxStream(streamId: string) {
  try {
    await mux.video.liveStreams.enable(streamId);
    return { success: true, streamId };
  } catch (error) {
    console.error("Mux stream enable error:", error);
    throw new Error("Failed to enable Mux stream");
  }
}

// Helper to check Mux stream health
export async function getMuxStreamHealth(streamId: string) {
  try {
    const liveStream = await mux.video.liveStreams.retrieve(streamId);

    return {
      streamId: liveStream.id,
      isActive: liveStream.status === "active",
      status: liveStream.status,
      reconnectWindow: liveStream.reconnect_window,
      latencyMode: liveStream.latency_mode,
      lastSeen: liveStream.recent_asset_ids?.[0] || null,
    };
  } catch (error) {
    console.error("Mux stream health error:", error);
    throw new Error("Failed to get stream health");
  }
}
