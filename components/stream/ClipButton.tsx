"use client";

import { useState } from "react";
import { Scissors } from "lucide-react";
import { toast } from "sonner";

interface ClipButtonProps {
  streamerUsername: string;
  /** Approximate seconds elapsed since stream started (for start_offset) */
  streamElapsedSeconds?: number;
  className?: string;
}

/**
 * ✂️ Clip button — lets any authenticated viewer create a 30-second clip
 * from the current live stream position.
 */
export function ClipButton({ streamerUsername, streamElapsedSeconds = 0, className = "" }: ClipButtonProps) {
  const [loading, setLoading] = useState(false);
  const [justClipped, setJustClipped] = useState(false);

  const handleClip = async () => {
    if (loading || justClipped) {
      return;
    }
    setLoading(true);
    try {
      // Clip the last 30 seconds
      const duration = 30;
      const start_offset = Math.max(0, streamElapsedSeconds - duration);

      const res = await fetch("/api/streams/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          streamer_username: streamerUsername,
          start_offset,
          duration,
        }),
      });

      if (res.status === 401) {
        toast.error("Sign in to create clips");
        return;
      }
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        toast.error(error ?? "Failed to create clip");
        return;
      }

      toast.success("Clip created! It'll be ready in a moment.");
      setJustClipped(true);
      // Reset after 10 s so they can clip again
      setTimeout(() => setJustClipped(false), 10_000);
    } catch {
      toast.error("Failed to create clip");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClip}
      disabled={loading || justClipped}
      title="Create a 30-second clip"
      aria-label="Create clip"
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
        ${justClipped
          ? "bg-green-600/20 text-green-400 cursor-default"
          : "bg-muted hover:bg-accent text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        } ${className}`}
    >
      <Scissors className="w-4 h-4" />
      {loading ? "Clipping…" : justClipped ? "Clipped!" : "Clip"}
    </button>
  );
}
