"use client";

import MuxPlayer from "@mux/mux-player-react";

interface MuxVideoPlayerProps {
  playbackId: string;
  streamIsActive?: boolean;
  title?: string;
  className?: string;
  videoId?: string;
  viewerUserId?: string;
}

export default function MuxVideoPlayer({
  playbackId,
  streamIsActive = false,
  title = "Live Stream",
  className = "",
  videoId,
  viewerUserId,
}: MuxVideoPlayerProps) {
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
    <div className={`relative ${className}`}>
      <MuxPlayer
        playbackId={playbackId}
        streamType="live"
        autoPlay="muted"
        metadata={{
          video_id: videoId || playbackId,
          video_title: title,
          viewer_user_id: viewerUserId || "anonymous",
        }}
        primaryColor="#FFFFFF"
        secondaryColor="#000000"
      />
      {streamIsActive && (
        <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
          LIVE
        </div>
      )}
    </div>
  );
}
