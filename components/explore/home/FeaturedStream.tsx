"use client";

import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { useState, useRef } from "react";
import { motion } from "framer-motion";
import MuxPlayer from "@mux/mux-player-react";
import type { FeaturedStreamProps } from "@/types/explore/home";

export function FeaturedStream({ stream }: FeaturedStreamProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePlayPause = () => {
    if (!stream.playbackId) {
      return;
    }

    if (isPlaying) {
      playerRef.current?.pause();
    } else {
      playerRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleVolumeToggle = () => {
    if (playerRef.current) {
      playerRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video xl:aspect-[20/8.5] rounded-lg overflow-hidden border border-highlight"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Thumbnail background - always visible */}
      <motion.div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${stream.thumbnail})` }}
        animate={{
          scale: isHovering ? 1.1 : 1,
        }}
        transition={{
          duration: 0.5,
          ease: "easeOut",
        }}
      />

      {/* Mux Player - only visible when playing */}
      {isPlaying && stream.playbackId && (
        <div className="absolute inset-0 z-10">
          <MuxPlayer
            ref={playerRef}
            playbackId={stream.playbackId}
            streamType="ll-live:dvr"
            autoPlay="muted"
            muted={isMuted}
            metadata={{
              video_id: stream.playbackId,
              video_title: stream.title,
              viewer_user_id: "anonymous",
            }}
            primaryColor="#ac39f2"
            className="w-full h-full"
          />
        </div>
      )}

      {/* Overlay - only show when not playing or when hovering */}
      {(!isPlaying || isHovering) && (
        <div className="absolute inset-0 bg-black/40 z-20" />
      )}

      {stream.isLive && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-md font-medium z-30"
        >
          Live
        </motion.div>
      )}

      {stream.streamerThumbnail && (
        <div className="absolute top-4 right-4 w-16 h-16 rounded-md overflow-hidden border-2 border-purple-500 z-30">
          <img
            src={stream.streamerThumbnail || "/placeholder.svg"}
            alt="Streamer"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {(!isPlaying || isHovering) && (
        <div className="absolute bottom-16 left-4 right-4 text-white z-30">
          <h1 className="text-base md:text-3xl font-bold mb-2">
            {stream.title}
          </h1>
        </div>
      )}

      {(!isPlaying || isHovering) && (
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={handlePlayPause}
              className="hover:text-purple-400 transition-colors"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6" />
              )}
            </button>
            <button
              onClick={handleVolumeToggle}
              className="hover:text-purple-400 transition-colors"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX className="w-6 h-6" />
              ) : (
                <Volume2 className="w-6 h-6" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleFullscreen}
              className="hover:text-purple-400 transition-colors"
              aria-label="Fullscreen"
            >
              <Maximize className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
