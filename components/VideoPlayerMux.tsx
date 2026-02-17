"use client";

import MuxPlayer from "@mux/mux-player-react";

interface VideoPlayerMuxProps {
  playbackId: string;
  addLog: (message: string, type?: "info" | "success" | "error") => void;
}

export default function VideoPlayerMux({
  playbackId,
  addLog,
}: VideoPlayerMuxProps) {
  if (!playbackId) {
    return (
      <div className="w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center text-white">
        <div className="text-center p-6">
          <div className="text-4xl mb-4">📺</div>
          <p className="text-lg">No stream available</p>
          <p className="text-sm text-gray-400 mt-2">
            Create a stream to start broadcasting
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-black rounded-lg overflow-hidden">
      <MuxPlayer
        playbackId={playbackId}
        streamType="ll-live"
        autoPlay="muted"
        metadata={{
          video_id: playbackId,
          video_title: "Live Stream Test",
          viewer_user_id: "test-user",
        }}
        primaryColor="#ac39f2"
        secondaryColor="#000000"
        targetLiveWindow={1.5}
        maxResolution="1080p"
        minResolution="480p"
        preferPlayback="mse"
        startTime={-10}
        preload="auto"
        onLoadStart={() => addLog("Mux Player: Loading stream...", "info")}
        onCanPlay={() => addLog("Mux Player: Ready to play", "success")}
        onPlaying={() => addLog("Mux Player: Playing!", "success")}
        onWaiting={() => addLog("Mux Player: Buffering...", "info")}
        onError={(error: any) => {
          console.error("Mux Player error (full):", error);

          // Extract error details from the event
          const errorDetails =
            error?.detail || (error?.target as any)?.error || error;
          const errorMessage =
            errorDetails?.message || errorDetails?.code || "Unknown error";
          const errorCode = errorDetails?.code || errorDetails?.name || "";

          console.error("Error details:", {
            message: errorMessage,
            code: errorCode,
            detail: error?.detail,
            target: (error?.target as any)?.error,
          });

          addLog(
            `Mux Player error: ${errorCode ? `[${errorCode}] ` : ""}${errorMessage}`,
            "error"
          );
        }}
      />
    </div>
  );
}
