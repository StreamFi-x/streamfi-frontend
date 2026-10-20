"use client";

import React, { useState } from "react";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface LatencyMode = "low" | "standard";

interface LatencyModeSelectorProps {
  value: LatencyMode;
  onChange: (mode: LatencyMode) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Latency mode selector component with clear tradeoff messaging.
 *
 * Allows creators to choose between low-latency (minimal delay, no DVR)
 * and standard latency (higher delay, DVR/rewind enabled) before going live.
 *
 * This setting is fixed for the entire broadcast and cannot be changed mid-stream.
 */
export const LatencyModeSelector: React.FC<LatencyModeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = "",
}) => {
  const isLowLatency = value === "low";

  return (
    <Card className={`p-4 border border-border ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
          <Info className="w-4 h-4" />
          Stream Latency Mode
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Choose how fast your stream reaches viewers. This setting is fixed for your entire broadcast and cannot be changed mid-stream.
        </p>
      </div>

      <div className="space-y-3">
        {/* Low Latency Option */}
        <div
          onClick={() => !disabled && onChange("low")}
          className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
            isLowLatency
              ? "border-purple-600 bg-purple-50/10"
              : "border-border hover:border-purple-400/50 bg-card"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex items-start gap-3">
            <input
              type="radio"
              name="latency-mode"
              value="low"
              checked={isLowLatency}
              onChange={() => onChange("low")}
              disabled={disabled}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-foreground cursor-pointer">
                Low Latency (~3–5 seconds)
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                Minimal delay for real-time interaction. Viewers cannot rewind or skip backward. Best for:
              </p>
              <ul className="text-xs text-muted-foreground mt-2 ml-4 list-disc space-y-1">
                <li>Competitive gaming, esports, and reactions</li>
                <li>Live chat interaction and engagement</li>
                <li>Streams where viewer interaction is critical</li>
              </ul>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
                ⚠️ Tradeoff: Less buffering tolerance; viewers on poor connections may experience playback issues.
              </p>
            </div>
          </div>
        </div>

        {/* Standard Latency Option */}
        <div
          onClick={() => !disabled && onChange("standard")}
          className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
            !isLowLatency
              ? "border-purple-600 bg-purple-50/10"
              : "border-border hover:border-purple-400/50 bg-card"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex items-start gap-3">
            <input
              type="radio"
              name="latency-mode"
              value="standard"
              checked={!isLowLatency}
              onChange={() => onChange("standard")}
              disabled={disabled}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-foreground cursor-pointer">
                Standard Latency (~10–15 seconds)
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                Viewers can rewind and skip backward (DVR). More stable playback. Best for:
              </p>
              <ul className="text-xs text-muted-foreground mt-2 ml-4 list-disc space-y-1">
                <li>Educational content, tutorials, and talks</li>
                <li>Unstable upload connections or mobile streaming</li>
                <li>Streams prioritizing stability over minimal latency</li>
              </ul>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
                ✓ Tradeoff: Higher viewer-side buffering tolerance; better experience on poor networks.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 bg-muted rounded-lg border border-border">
        <p className="text-xs text-muted-foreground">
          <strong>📋 Note:</strong> Your current default is <span className="font-medium">{isLowLatency ? "Low Latency" : "Standard Latency"}</span>. You can change your global default anytime in Stream Settings after going live.
        </p>
      </div>
    </Card>
  );
};

export default LatencyModeSelector;
