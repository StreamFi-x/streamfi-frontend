"use client";

import { useEffect, useState } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { getMuxViewerId } from "@/lib/mux/viewer-id";
import { useNetworkQuality, getNetworkStatusDescription, getMaxQualityForNetwork } from "@/hooks/useNetworkQuality";
import { resolveQuality, toMuxQuality, logQualitySelection, type Quality } from "@/lib/video/quality-selection";

interface VideoPlayerMuxProps {
  playbackId: string;
  /** Stream title reported to Mux Data. */
  title?: string;
  /**
   * Signed-in viewer's wallet address or user id; omit when logged out. It is
   * hashed before it reaches Mux Data, never sent as is.
   */
  viewerIdentity?: string | null;
  addLog: (message: string, type?: "info" | "success" | "error") => void;
}

export default function VideoPlayerMux({
  playbackId,
  title,
  viewerIdentity,
  addLog,
}: VideoPlayerMuxProps) {
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [manualQuality, setManualQuality] = useState<Quality | undefined>(undefined);
  const [showNetworkInfo, setShowNetworkInfo] = useState(false);
  
  // Get network quality information
  const networkQuality = useNetworkQuality();
  
  // Determine the connection-aware quality cap
  const connectionQualityCap = getMaxQualityForNetwork(networkQuality);

  // Resolve final quality with precedence: manual override > connection cap > ABR
  const qualityResolution = resolveQuality({
    manualSelection: manualQuality,
    connectionCap: connectionQualityCap as Quality | undefined,
    saveDataEnabled: networkQuality.saveData,
    isMeteredConnection: networkQuality.isMetered,
  });

  const maxQuality = toMuxQuality(qualityResolution.quality);

  useEffect(() => {
    let cancelled = false;
    setViewerId(null);
    getMuxViewerId(viewerIdentity).then(id => {
      if (!cancelled) {
        setViewerId(id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [viewerIdentity]);

  // Log quality selection in development
  useEffect(() => {
    logQualitySelection(qualityResolution);
  }, [qualityResolution]);

  // Log network changes
  useEffect(() => {
    if (networkQuality.isSupported && qualityResolution.isConstrained) {
      addLog(
        `Network detected: ${getNetworkStatusDescription(networkQuality)}`,
        "info"
      );
    }
  }, [networkQuality, qualityResolution, addLog]);

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

  // Hold the player until the id is ready: Mux Data fixes the viewer when the
  // session starts, so mounting first would report this viewer as someone else.
  if (!viewerId) {
    return (
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video" />
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
          video_title: title || "Live Stream",
          viewer_user_id: viewerId,
        }}
        primaryColor="#ac39f2"
        secondaryColor="#000000"
        targetLiveWindow={1.5}
        maxResolution={maxQuality as "auto" | "1080p" | "720p" | "480p" | "360p" | "240p"}
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
      
      {/* Network info indicator - shown when quality is constrained */}
      {qualityResolution.isConstrained && networkQuality.isSupported && (
        <div className="absolute top-4 right-4 group">
          <button
            onClick={() => setShowNetworkInfo(!showNetworkInfo)}
            className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold hover:bg-blue-700 transition-colors"
            title="Click to see network details"
          >
            Quality Capped: {qualityResolution.quality}
          </button>
          
          {/* Tooltip showing network details */}
          {showNetworkInfo && (
            <div className="absolute top-8 right-0 bg-gray-900 text-white text-xs p-3 rounded shadow-lg whitespace-nowrap border border-blue-600 z-10">
              <div className="font-semibold mb-1">Network Status</div>
              {networkQuality.saveData && (
                <div>📊 Data Saver: Enabled</div>
              )}
              <div>📡 Type: {networkQuality.connectionType}</div>
              {networkQuality.effectiveBandwidth !== null && (
                <div>⚡ Bandwidth: ~{networkQuality.effectiveBandwidth.toFixed(1)} Mbps</div>
              )}
              <div className="mt-1 pt-1 border-t border-gray-600 text-gray-400">
                Quality set to {qualityResolution.quality}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
