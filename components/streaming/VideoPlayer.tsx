"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";
import * as Player from "@livepeer/react/player";
import { getSrc } from "@livepeer/react/external";
import { Livepeer } from "livepeer";
import { PlaybackInfo } from "livepeer/models/components";

interface VideoPlayerProps {
  hlsUrl?: string;
  rtmpUrl?: string;
  dashUrl?: string;
  title?: string;
  isLive?: boolean;
  viewerCount?: number;
  playbackId?: string;
}
export default function VideoPlayer({
  title = "Stream",
  isLive = false,
  viewerCount = 0,
  playbackId = "",
}: VideoPlayerProps) {
  const [playbackSrc, setPlaybackSrc] = useState<PlaybackInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getPlaybackSource = async (playbackId: string) => {
      if (!playbackId) {
        setError("No playback ID provided");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const livepeer = new Livepeer({
          apiKey: process.env.NEXT_PUBLIC_LIVEPEER_API_KEY!,
        });
        const playbackInfo = await livepeer.playback.get(playbackId);

        if (!playbackInfo.playbackInfo) {
          throw new Error("No playback info available");
        }

        const src = getSrc(playbackInfo.playbackInfo);
        setPlaybackSrc(playbackInfo.playbackInfo);
        console.log("Playback source:", src);
      } catch (err) {
        console.error("Error fetching playback source:", err);
        setError(err instanceof Error ? err.message : "Failed to load stream");
      } finally {
        setIsLoading(false);
      }
    };

    getPlaybackSource(playbackId);
  }, [playbackId]);

  const src = getSrc(playbackSrc);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          {title}
          {isLive && (
            <Badge variant="destructive" className="animate-pulse">
              LIVE
            </Badge>
          )}
          {viewerCount > 0 && (
            <Badge variant="secondary">{viewerCount} viewers</Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="relative bg-black rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 bg-black/50">
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p>Loading stream...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 bg-black/50">
              <div className="text-white text-center">
                <p className="font-semibold mb-2">Playback Error</p>
                <p className="text-sm mb-4">{error}</p>
                <button
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded text-white"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </button>
              </div>
            </div>
          ) : playbackSrc ? (
            <Player.Root
              src={src}
              autoPlay={false}
              volume={0.8}
              lowLatency={isLive}
              timeout={10000}
            >
              <Player.Container className="w-full h-auto">
                <Player.Video
                  title={title}
                  className="w-full h-auto"
                  poster="/placeholder-video.jpg"
                />

                <Player.Controls className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <div className="flex items-center gap-4">
                    <Player.PlayPauseTrigger className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white">
                      <Player.PlayingIndicator asChild matcher={false}>
                        <svg
                          className="w-5 h-5 ml-0.5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </Player.PlayingIndicator>
                      <Player.PlayingIndicator asChild>
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                        </svg>
                      </Player.PlayingIndicator>
                    </Player.PlayPauseTrigger>

                    <Player.MuteTrigger className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white">
                      <Player.VolumeIndicator asChild matcher={false}>
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                        </svg>
                      </Player.VolumeIndicator>
                      <Player.VolumeIndicator asChild>
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                        </svg>
                      </Player.VolumeIndicator>
                    </Player.MuteTrigger>

                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
                    />

                    <div className="flex-1 text-white text-sm">
                      <Player.Time />
                    </div>

                    <Player.FullscreenTrigger className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                      </svg>
                    </Player.FullscreenTrigger>
                  </div>
                </Player.Controls>

                <Player.LoadingIndicator className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                    <p>Loading stream...</p>
                  </div>
                </Player.LoadingIndicator>

                <Player.ErrorIndicator
                  matcher="all"
                  className="absolute inset-0 flex items-center justify-center bg-black/50"
                >
                  <div className="text-white text-center">
                    <p className="font-semibold mb-2">Playback Error</p>
                    <p className="text-sm mb-4">Unable to load the stream</p>
                    <button className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded text-white">
                      Retry
                    </button>
                  </div>
                </Player.ErrorIndicator>
              </Player.Container>
            </Player.Root>
          ) : (
            <div className="flex items-center justify-center h-64 bg-black/50">
              <div className="text-white text-center">
                <p className="font-semibold mb-2">No Stream Available</p>
                <p className="text-sm">Please provide a valid playback ID</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
