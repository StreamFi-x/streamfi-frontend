import { Livepeer } from "livepeer";

const livepeer = new Livepeer({
  apiKey: process.env.LIVEPEER_API_KEY!,
});

export interface StreamSession {
  id: string;
  walletAddress: string;
  streamId: string;
  playbackId: string;
  streamKey: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamHealth {
  isActive: boolean;
  lastSeen?: string;
  ingestRate?: number;
  outgoingRate?: number;
  viewerCount?: number;
}

export interface StreamMetrics {
  streamId: string;
  isActive: boolean;
  lastSeen?: string;
  ingestRate?: number;
  outgoingRate?: number;
  duration?: number;
  viewerCount?: number;
}

export class LivepeerStreamingService {
  private static instance: LivepeerStreamingService;

  private constructor() {
    if (!process.env.LIVEPEER_API_KEY) {
      throw new Error("LIVEPEER_API_KEY environment variable is required");
    }
  }

  public static getInstance(): LivepeerStreamingService {
    if (!LivepeerStreamingService.instance) {
      LivepeerStreamingService.instance = new LivepeerStreamingService();
    }
    return LivepeerStreamingService.instance;
  }

  /**
   * Create a new stream for a wallet address
   */
  async createStream(
    walletAddress: string,
    streamData: {
      title: string;
      description?: string;
      category?: string;
      tags?: string[];
      record?: boolean;
    }
  ): Promise<{
    streamId: string;
    playbackId: string;
    streamKey: string;
    ingestUrl: string;
    rtmpUrl: string;
  }> {
    try {
      const response = await livepeer.stream.create({
        name: `${walletAddress} - ${streamData.title}`,
        record: streamData.record ?? true,
        profiles: [
          {
            name: "240p0",
            fps: 0,
            bitrate: 250000,
            width: 426,
            height: 240,
          },
          {
            name: "360p0",
            fps: 0,
            bitrate: 800000,
            width: 640,
            height: 360,
          },
          {
            name: "480p0",
            fps: 0,
            bitrate: 1600000,
            width: 854,
            height: 480,
          },
          {
            name: "720p0",
            fps: 0,
            bitrate: 3000000,
            width: 1280,
            height: 720,
          },
        ],
        multistream: {
          targets: [],
        },
      });

      if (
        !response.stream?.id ||
        !response.stream?.playbackId ||
        !response.stream?.streamKey
      ) {
        throw new Error("Incomplete stream data received from Livepeer");
      }

      return {
        streamId: response.stream.id,
        playbackId: response.stream.playbackId,
        streamKey: response.stream.streamKey,
        ingestUrl: `rtmp://ingest.livepeer.com/live/${response.stream.streamKey}`,
        rtmpUrl: `rtmp://ingest.livepeer.com/live/${response.stream.streamKey}`,
      };
    } catch (error) {
      throw new Error(
        `Failed to create stream: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get stream information by stream ID
   */
  async getStream(streamId: string): Promise<{
    id: string;
    name: string;
    playbackId: string;
    streamKey: string;
    isActive: boolean;
    lastSeen?: string;
    createdAt: string;
    isHealthy?: boolean | null;
    suspended?: boolean;
    lastTerminatedAt?: number;
    profiles?: Array<{
      name: string;
      fps: number;
      bitrate: number;
      width: number;
      height: number;
    }>;
  }> {
    try {
      const response = await livepeer.stream.get(streamId);

      if (!response.stream) {
        throw new Error("Stream not found");
      }

      return {
        id: response.stream.id || "",
        name: response.stream.name,
        playbackId: response.stream.playbackId || "",
        streamKey: response.stream.streamKey || "",
        isActive: response.stream.isActive || false,
        lastSeen: response.stream.lastSeen?.toString(),
        createdAt: response.stream.createdAt?.toString() || "",
        isHealthy: (response.stream as any).isHealthy,
        suspended: (response.stream as any).suspended,
        lastTerminatedAt: (response.stream as any).lastTerminatedAt,
        profiles: (response.stream as any).profiles,
      };
    } catch (error) {
      throw new Error(
        `Failed to get stream: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Update stream information
   */
  async updateStream(
    streamId: string,
    updateData: {
      name?: string;
      record?: boolean;
    }
  ): Promise<{
    id: string;
    name: string;
    record: boolean;
  }> {
    try {
      await livepeer.stream.update(updateData, streamId);

      const streamResponse = await livepeer.stream.get(streamId);

      if (!streamResponse.stream) {
        throw new Error("Failed to get updated stream");
      }

      return {
        id: streamResponse.stream.id || "",
        name: streamResponse.stream.name,
        record: streamResponse.stream.record || false,
      };
    } catch (error) {
      throw new Error(
        `Failed to update stream: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Terminate a stream (stops the stream but keeps it for later use)
   */
  async terminateStream(streamId: string): Promise<boolean> {
    try {
      await livepeer.stream.terminate(streamId);
      return true;
    } catch (error) {
      throw new Error(
        `Failed to terminate stream: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Delete a stream (permanently removes the stream)
   */
  async deleteStream(streamId: string): Promise<boolean> {
    try {
      await livepeer.stream.delete(streamId);
      return true;
    } catch (error) {
      throw new Error(
        `Failed to delete stream: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get stream health and metrics
   */
  async getStreamHealth(streamId: string): Promise<StreamHealth> {
    try {
      const response = await livepeer.stream.get(streamId);

      if (!response.stream) {
        throw new Error("Stream not found");
      }

      return {
        isActive: response.stream.isActive || false,
        lastSeen: response.stream.lastSeen?.toString(),
        ingestRate: response.stream.ingestRate,
        outgoingRate: response.stream.outgoingRate,
        viewerCount: undefined, // Not available in current Livepeer API
      };
    } catch (error) {
      throw new Error(
        `Failed to get stream health: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get stream metrics for analytics
   */
  async getStreamMetrics(streamId: string): Promise<StreamMetrics> {
    try {
      const response = await livepeer.stream.get(streamId);

      if (!response.stream) {
        throw new Error("Stream not found");
      }

      return {
        streamId: response.stream.id || "",
        isActive: response.stream.isActive || false,
        lastSeen: response.stream.lastSeen?.toString(),
        ingestRate: response.stream.ingestRate,
        outgoingRate: response.stream.outgoingRate,
        duration: undefined, // Duration not available in current Livepeer API
        viewerCount: undefined, // Viewer count not available in current Livepeer API
      };
    } catch (error) {
      throw new Error(
        `Failed to get stream metrics: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get playback information for a stream
   */
  async getPlaybackInfo(playbackId: string) {
    try {
      const response = await livepeer.playback.get(playbackId);

      if (!response.playbackInfo) {
        throw new Error("Playback info not found");
      }

      const playbackInfo = response.playbackInfo;

      return {
        playbackId: playbackId,
        playbackInfo: playbackInfo,
      };
    } catch (error) {
      throw new Error(
        `Failed to get playback info: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * List all streams for a wallet (if needed for admin purposes)
   */
  async listStreams(): Promise<
    {
      id: string;
      name: string;
      playbackId: string;
      isActive: boolean;
      createdAt: string;
      streamKey?: string;
      isHealthy?: boolean | null;
      suspended?: boolean;
      lastTerminatedAt?: number;
      profiles?: Array<{
        name: string;
        fps: number;
        bitrate: number;
        width: number;
        height: number;
      }>;
    }[]
  > {
    try {
      const response = await livepeer.stream.getAll();
      console.log(response.data);

      // Handle the actual response structure - it's an array directly
      // const streams =

      return (
        response.data?.map((stream: any) => ({
          id: stream.id,
          name: stream.name,
          playbackId: stream.playbackId,
          isActive: stream.isActive || false,
          createdAt: stream.createdAt?.toString() || "",
          streamKey: stream.streamKey,
          isHealthy: stream.isHealthy,
          suspended: stream.suspended,
          lastTerminatedAt: stream.lastTerminatedAt,
          profiles: stream.profiles,
        })) || []
      );
    } catch (error) {
      throw new Error(
        `Failed to list streams: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Validate that the service is properly configured
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      if (!process.env.LIVEPEER_API_KEY) {
        return false;
      }

      // Test the connection by listing streams
      const streams = await this.listStreams();
      console.log("Streams:", streams);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const livepeerService = LivepeerStreamingService.getInstance();
