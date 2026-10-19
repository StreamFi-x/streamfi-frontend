"use client";

import { useState } from "react";
import { Radio, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { toast } from "sonner";
import LatencyModeSelector, { type LatencyMode } from "@/components/stream/LatencyModeSelector";

interface StreamControlsProps {
  isLive: boolean;
  onStreamStateChange?: (isLive: boolean) => void;
}

export default function StreamControls({
  isLive,
  onStreamStateChange,
}: StreamControlsProps) {
  const { publicKey: address } = useStellarWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [liveState, setLiveState] = useState(isLive);
  const [selectedLatencyMode, setSelectedLatencyMode] = useState<LatencyMode>("low");
  const [showLatencySelector, setShowLatencySelector] = useState(false);

  const handleStartStream = async () => {
    if (!address) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch("/api/streams/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          wallet: address,
          latencyMode: selectedLatencyMode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start stream");
      }

      setLiveState(true);
      setShowLatencySelector(false);
      onStreamStateChange?.(true);
      toast.success(`Stream started in ${selectedLatencyMode === "standard" ? "standard" : "low"}-latency mode! You're now live 🎥`);
    } catch (error) {
      console.error("Failed to start stream:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to start stream"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopStream = async () => {
    if (!address) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch("/api/streams/start", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to stop stream");
      }

      setLiveState(false);
      onStreamStateChange?.(false);
      toast.success("Stream stopped successfully");
    } catch (error) {
      console.error("Failed to stop stream:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to stop stream"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-card p-4 rounded-lg border border-border">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-foreground font-semibold text-sm">
            Stream Controls
          </h3>
          <p className="text-muted-foreground text-xs mt-1">
            {liveState ? "Your stream is live" : "Start streaming to go live"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${liveState ? "bg-red-600 animate-pulse" : "bg-gray-600"}`}
          />
          <span className="text-xs font-medium text-muted-foreground">
            {liveState ? "LIVE" : "OFFLINE"}
          </span>
        </div>
      </div>

      <div className="text-xs text-muted-foreground mb-3 bg-muted p-2 rounded">
        ?? <strong>Tip:</strong> Start streaming in OBS first, then click
        &quot;Start Stream&quot; to mark yourself as live.
      </div>

      {!liveState && !showLatencySelector && (
        <Button
          onClick={() => setShowLatencySelector(true)}
          disabled={isLoading}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
        >
          <Radio className="w-4 h-4 mr-2" />
          {isLoading ? "Starting..." : "Start Stream"}
        </Button>
      )}

      {showLatencySelector && !liveState && (
        <div className="space-y-3">
          <LatencyModeSelector
            value={selectedLatencyMode}
            onChange={setSelectedLatencyMode}
            disabled={isLoading}
          />
          <div className="flex gap-2">
            <Button
              onClick={handleStartStream}
              disabled={isLoading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <Radio className="w-4 h-4 mr-2" />
              {isLoading ? "Starting..." : "Go Live"}
            </Button>
            <Button
              onClick={() => setShowLatencySelector(false)}
              disabled={isLoading}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {liveState && (
        <Button
          onClick={handleStopStream}
          disabled={isLoading}
          className="w-full bg-red-600 hover:bg-red-700 text-white"
        >
          <Square className="w-4 h-4 mr-2" />
          {isLoading ? "Stopping..." : "Stop Stream"}
        </Button>
      )}

      <p className="text-xs text-muted-foreground mt-3 text-center">
        This button is temporary. Set up Mux webhooks for automatic detection.
      </p>
    </div>
  );
}
