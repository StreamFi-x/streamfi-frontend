/**
 * useReactions hook
 * Client-side reaction system with rate limiting, aggregation, and animation
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useRealtimeChannel } from "./useRealtime";
import { REACTION_TYPES, type ReactionType, type AggregatedReactionBroadcast } from "@/lib/reactions";

export interface UseReactionsOptions {
  playbackId: string;
  viewerId?: string;
  enabled?: boolean;
}

export interface ReactionsState {
  aggregatedReactions: {
    [key in ReactionType]?: number;
  };
  isRateLimited: boolean;
  remainingTokens: number;
}

/**
 * Hook for displaying and sending reactions
 */
export function useReactions({
  playbackId,
  viewerId = "anonymous",
  enabled = true,
}: UseReactionsOptions) {
  const [state, setState] = useState<ReactionsState>({
    aggregatedReactions: {},
    isRateLimited: false,
    remainingTokens: 0,
  });

  // Subscribe to aggregated reaction broadcasts
  const aggregatedChannel = enabled ? `stream:${playbackId}:reactions:aggregated` : null;

  useRealtimeChannel(
    aggregatedChannel,
    useCallback(
      (msg: any) => {
        if (msg.event === "reactions:batch" && msg.data?.reactions) {
          setState((prev) => ({
            ...prev,
            aggregatedReactions: msg.data.reactions,
          }));
        }
      },
      []
    )
  );

  /**
   * Send a reaction from this user
   */
  const sendReaction = useCallback(
    async (reactionType: ReactionType) => {
      if (!enabled) return;

      try {
        const response = await fetch("/api/streams/reactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            streamId: playbackId,
            reactionType,
            viewerId,
          }),
        });

        const data = await response.json();

        if (response.status === 429) {
          // Rate limited
          setState((prev) => ({
            ...prev,
            isRateLimited: true,
            remainingTokens: data.remaining || 0,
          }));

          // Clear rate limit flag after 1 second
          setTimeout(() => {
            setState((prev) => ({ ...prev, isRateLimited: false }));
          }, 1000);
        } else if (response.ok) {
          setState((prev) => ({
            ...prev,
            isRateLimited: false,
            remainingTokens: data.remaining || 0,
          }));
        }
      } catch (error) {
        console.error("[useReactions] Failed to send reaction:", error);
      }
    },
    [playbackId, viewerId, enabled]
  );

  /**
   * Get visual density for reaction animation
   * Based on aggregate count: 1-10 = light, 11-50 = medium, 50+ = heavy
   */
  const getReactionDensity = useCallback((reactionType: ReactionType): "light" | "medium" | "heavy" => {
    const count = state.aggregatedReactions[reactionType] || 0;
    if (count <= 10) return "light";
    if (count <= 50) return "medium";
    return "heavy";
  }, [state.aggregatedReactions]);

  /**
   * Get count for a specific reaction type
   */
  const getReactionCount = useCallback(
    (reactionType: ReactionType): number => {
      return state.aggregatedReactions[reactionType] || 0;
    },
    [state.aggregatedReactions]
  );

  return {
    ...state,
    sendReaction,
    getReactionDensity,
    getReactionCount,
  };
}

/**
 * Keyboard shortcut handler for quick reactions
 */
export function useReactionKeyboard(
  enabled: boolean,
  onReaction: (type: ReactionType) => void
) {
  const keyMapRef = useRef<Record<string, ReactionType>>({
    h: REACTION_TYPES.HEART,
    l: REACTION_TYPES.LAUGH,
    w: REACTION_TYPES.WOW,
    f: REACTION_TYPES.FIRE,
    c: REACTION_TYPES.CLAP,
  });

  useEffect(() => {
    if (!enabled) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if not typing in input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return;
      }

      const reactionType = keyMapRef.current[e.key.toLowerCase()];
      if (reactionType) {
        e.preventDefault();
        onReaction(reactionType);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [enabled, onReaction]);
}
