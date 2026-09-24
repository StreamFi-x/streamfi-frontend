import Mux from "@mux/mux-node";
import { logger } from "@/lib/tracing/logger";
import { getTraceHeaders } from "@/lib/tracing/trace-context";

// Check if Mux credentials are configured
if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
  const errorMsg = "Mux credentials not configured!";
  logger.error(errorMsg, {
    muxTokenIdPresent: !!process.env.MUX_TOKEN_ID,
    muxTokenSecretPresent: !!process.env.MUX_TOKEN_SECRET,
  });
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
  signedPlaybackId?: string;
  status: string;
  rtmpUrl: string;
  isActive?: boolean;
}

const MUX_CREATE_TIMEOUT_MS = 8_000;

export async function createMuxStream(streamData?: {
  name: string;
  record?: boolean;
  latencyMode?: "low" | "standard";
  withSignedPlayback?: boolean;
}) {
  const startTime = Date.now();
  const traceHeaders = getTraceHeaders();

  try {
    logger.info("Creating Mux stream", {
      operation: "createMuxStream",
      record: streamData?.record,
      latencyMode: streamData?.latencyMode,
    });

    const record = streamData?.record === true;
    const latencyMode = streamData?.latencyMode ?? "low";

    const liveStream = await Promise.race([
      mux.video.liveStreams.create({
        playback_policy: ["public"],
        ...(record && {
          new_asset_settings: {
            playback_policy: ["public"],
          },
        }),
        reconnect_window: 60,
        latency_mode: latencyMode,
        max_continuous_duration: 43200,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Mux API timed out after 8 s")),
          MUX_CREATE_TIMEOUT_MS
        )
      ),
    ]);

    // Get the playback ID from the created stream
    const playbackId = liveStream.playback_ids?.[0]?.id || "";

    const durationMs = Date.now() - startTime;
    logger.info("Mux stream created successfully", {
      operation: "createMuxStream",
      streamId: liveStream.id,
      durationMs,
    });

    return {
      id: liveStream.id,
      streamKey: liveStream.stream_key || "",
      playbackId,
      signedPlaybackId: undefined,
      status: liveStream.status || "idle",
      rtmpUrl: "rtmp://global-live.mux.com:5222/app",
      isActive: liveStream.status === "active",
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    logger.error("Mux stream creation failed", {
      operation: "createMuxStream",
      durationMs,
      errorMessage: error?.message,
      muxStatus: error?.response?.status,
    });
    throw new Error(`Failed to create Mux stream: ${error?.message || error}`);
  }
}

export async function getMuxStream(streamId: string) {
  const startTime = Date.now();

  try {
    logger.debug("Retrieving Mux stream", {
      operation: "getMuxStream",
      streamId,
    });

    const liveStream = await mux.video.liveStreams.retrieve(streamId);

    const durationMs = Date.now() - startTime;
    logger.debug("Mux stream retrieved", {
      operation: "getMuxStream",
      streamId,
      durationMs,
    });

    return {
      id: liveStream.id,
      streamKey: liveStream.stream_key || "",
      playbackId: liveStream.playback_ids?.[0]?.id || "",
      signedPlaybackId: undefined,
      status: liveStream.status || "idle",
      rtmpUrl: "rtmp://global-live.mux.com:5222/app",
      isActive: liveStream.status === "active",
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error("Mux stream retrieval failed", {
      operation: "getMuxStream",
      streamId,
      durationMs,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Failed to retrieve Mux stream");
  }
}

export async function deleteMuxStream(streamId: string) {
  const startTime = Date.now();

  try {
    logger.info("Deleting Mux stream", {
      operation: "deleteMuxStream",
      streamId,
    });

    await mux.video.liveStreams.delete(streamId);

    const durationMs = Date.now() - startTime;
    logger.info("Mux stream deleted", {
      operation: "deleteMuxStream",
      streamId,
      durationMs,
    });

    return true;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error("Mux stream deletion failed", {
      operation: "deleteMuxStream",
      streamId,
      durationMs,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Failed to delete Mux stream");
  }
}

export async function getMuxStreamMetrics(streamId: string) {
  const startTime = Date.now();

  try {
    logger.debug("Fetching Mux stream metrics", {
      operation: "getMuxStreamMetrics",
      streamId,
    });

    const liveStream = await mux.video.liveStreams.retrieve(streamId);

    const durationMs = Date.now() - startTime;
    logger.debug("Mux stream metrics fetched", {
      operation: "getMuxStreamMetrics",
      streamId,
      durationMs,
    });

    return {
      streamId: liveStream.id,
      status: liveStream.status || "idle",
      isActive: liveStream.status === "active",
      createdAt: liveStream.created_at,
      reconnectWindow: liveStream.reconnect_window,
      latencyMode: liveStream.latency_mode,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error("Mux metrics fetch failed", {
      operation: "getMuxStreamMetrics",
      streamId,
      durationMs,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
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

/**
 * Update recording preference on an existing Mux live stream.
 * Must be called whenever enable_recording changes — recording is baked into
 * new_asset_settings at stream creation time, so toggling the DB flag alone
 * has no effect on streams that already exist in Mux.
 */
/**
 * Recording policy (playback_policy inside new_asset_settings) is baked in at
 * stream-creation time and cannot be changed via the Mux update endpoint.
 * This function is a no-op intentionally — recording changes take effect the
 * next time a Mux stream is created for this user.
 */

export async function updateMuxStreamRecording(
  _streamId: string,
  _enable: boolean
): Promise<{ success: true }> {
  return { success: true };
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
