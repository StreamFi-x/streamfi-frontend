"use client";

import { useState } from "react";
import { Radio, Square, AlertCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStellarWallet } from "@/contexts/stellar-wallet-context";
import { useDiagnostics } from "@/hooks/useDiagnostics";
import PreflightDiagnosticsPanel from "./PreflightDiagnosticsPanel";
import { toast } from "sonner";

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
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const diagnostics = useDiagnostics();

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
        body: JSON.stringify({ wallet: address }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start stream");
      }

      setLiveState(true);
      onStreamStateChange?.(true);
      toast.success("Stream started! You're now live ??");
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
    <div className="space-y-4">
      {/* Diagnostics Warning Badge */}
      {diagnostics.results && diagnostics.results.health.status !== "good" && (
        <div className="bg-card p-3 rounded-lg border border-border flex items-start gap-2">
          {diagnostics.results.health.status === "poor" ? (
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-foreground">Stream Health: {diagnostics.results.health.status}</h4>
            <p className="text-xs text-muted-foreground mt-1">{diagnostics.summary}</p>
            <p className="text-xs text-muted-foreground mt-1">
              ℹ️ You can still go live. This is just a warning to help improve quality.
            </p>
            <button
              onClick={() => setShowDiagnostics(true)}
              className="text-xs text-purple-600 hover:text-purple-700 font-medium mt-2"
            >
              View Details →
            </button>
          </div>
        </div>
      )}

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
          💡 <strong>Tip:</strong> Start streaming in OBS first, then click
          &quot;Start Stream&quot; to mark yourself as live.
        </div>

        {liveState ? (
          <Button
            onClick={handleStopStream}
            disabled={isLoading}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            <Square className="w-4 h-4 mr-2" />
            {isLoading ? "Stopping..." : "Stop Stream"}
          </Button>
        ) : (
          <>
            <Button
              onClick={handleStartStream}
              disabled={isLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Radio className="w-4 h-4 mr-2" />
              {isLoading ? "Starting..." : "Start Stream"}
            </Button>
            <Button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              variant="outline"
              className="w-full mt-2"
            >
              {showDiagnostics ? "Hide" : "Run"} Pre-Flight Diagnostics
            </Button>
          </>
        )}

        <p className="text-xs text-muted-foreground mt-3 text-center">
          This button is temporary. Set up Mux webhooks for automatic detection.
        </p>
      </div>

      {/* Diagnostics Panel */}
      {showDiagnostics && !liveState && (
        <PreflightDiagnosticsPanel onClose={() => setShowDiagnostics(false)} />
      )}
    </div>
  );
}
