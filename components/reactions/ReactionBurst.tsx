"use client";

import React, { useState, useEffect } from "react";
import { REACTION_METADATA, type ReactionType } from "@/lib/reactions";

interface ReactionBurstProps {
  reactionType: ReactionType;
  density: "light" | "medium" | "heavy";
  count: number;
}

/**
 * Renders floating reaction emoji with intensity proportional to aggregate count
 */
export function ReactionBurst({ reactionType, density, count }: ReactionBurstProps) {
  const [particles, setParticles] = useState<Array<{ id: string; x: number; y: number }>>([]);

  const metadata = REACTION_METADATA[reactionType];
  if (!metadata) return null;

  // Generate particle positions based on density
  useEffect(() => {
    if (count === 0) {
      setParticles([]);
      return;
    }

    // Number of particles to render: light (2-3), medium (4-6), heavy (8-12)
    const particleCount = {
      light: 2,
      medium: 4,
      heavy: 8,
    }[density];

    const newParticles = Array.from({ length: particleCount }).map((_, i) => ({
      id: `${reactionType}-${Date.now()}-${i}`,
      x: Math.random() * 100,
      y: Math.random() * 100,
    }));

    setParticles(newParticles);

    // Clear particles after animation completes
    const timer = setTimeout(() => {
      setParticles([]);
    }, metadata.animationDuration);

    return () => clearTimeout(timer);
  }, [count, density, reactionType, metadata]);

  return (
    <div className="fixed inset-0 pointer-events-none">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute text-2xl animate-float"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            animation: `float ${metadata.animationDuration}ms ease-out forwards`,
            opacity: density === "heavy" ? 0.8 : density === "medium" ? 0.6 : 0.4,
          }}
        >
          {metadata.emoji}
        </div>
      ))}

      <style>{`
        @keyframes float {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-120px) scale(0.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

interface ReactionBarProps {
  reactions: { [key in ReactionType]?: number };
  onReactionClick?: (type: ReactionType) => void;
}

/**
 * Button bar for sending reactions
 */
export function ReactionBar({ reactions, onReactionClick }: ReactionBarProps) {
  return (
    <div className="flex gap-2 p-2 bg-secondary rounded-lg border border-border">
      {Object.entries(REACTION_METADATA).map(([type, metadata]) => {
        const reactionType = type as ReactionType;
        const count = reactions[reactionType] || 0;

        return (
          <button
            key={reactionType}
            onClick={() => onReactionClick?.(reactionType)}
            title={`${metadata.label} (${metadata.keyCode ? `press ${metadata.keyCode}` : ""})`}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent transition-colors"
          >
            <span className="text-lg">{metadata.emoji}</span>
            {count > 0 && (
              <span className="text-xs font-medium text-muted-foreground">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
