"use client";

import { useState } from "react";
import { ChevronDown, AlertCircle, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDiagnostics } from "@/hooks/useDiagnostics";
import { EncoderSettings } from "@/lib/diagnostics/types";
import { toast } from "sonner";

interface PreflightDiagnosticsPanelProps {
  onClose?: () => void;
}

export default function PreflightDiagnosticsPanel({ onClose }: PreflightDiagnosticsPanelProps) {
  const diagnostics = useDiagnostics();
  const [isExpanded, setIsExpanded] = useState(true);
  const [bitrate, setBitrate] = useState("5000");
  const [resolution, setResolution] = useState("1920x1080");
  const [keyframeInterval, setKeyframeInterval] = useState("2000");

  const handleRunDiagnostics = async () => {
    // Validate inputs
    const bitrateNum = parseInt(bitrate);
    if (!bitrateNum || bitrateNum <= 0 || bitrateNum > 100000) {
      toast.error("Bitrate must be between 1 and 100000 kbps");
      return;
    }

    if (!/^\d+x\d+$/.test(resolution)) {
      toast.error("Resolution must be in format WIDTHxHEIGHT (e.g., 1920x1080)");
      return;
    }

    const keyframeNum = parseInt(keyframeInterval);
    if (!keyframeNum || keyframeNum <= 0) {
      toast.error("Keyframe interval must be positive");
      return;
    }

    const encoderSettings: EncoderSettings = {
      bitrate: bitrateNum,
      resolution,
      keyframeIntervalMs: keyframeNum,
    };

    await diagnostics.run(encoderSettings);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "info":
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case "error":
        return "bg-red-50 border-red-200";
      case "warning":
        return "bg-yellow-50 border-yellow-200";
      case "info":
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  return (
    <div className="bg-card p-4 rounded-lg border border-border">
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <h3 className="text-foreground font-semibold text-sm">Pre-Flight Diagnostics</h3>
          <p className="text-muted-foreground text-xs mt-1">
            Test your stream settings before going live
          </p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Encoder Settings Form */}
          <div className="space-y-3 p-3 bg-muted rounded border border-border">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Bitrate (kbps)
              </label>
              <input
                type="number"
                value={bitrate}
                onChange={e => setBitrate(e.target.value)}
                disabled={diagnostics.isLoading}
                className="w-full px-2 py-1 text-sm bg-card border border-border rounded text-foreground disabled:opacity-50"
                placeholder="5000"
                min="1"
                max="100000"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Match your encoder's bitrate setting
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Resolution
              </label>
              <div className="flex gap-2">
                {["1280x720", "1920x1080", "3840x2160"].map(res => (
                  <button
                    key={res}
                    onClick={() => setResolution(res)}
                    disabled={diagnostics.isLoading}
                    className={`px-3 py-1 text-xs rounded border transition-colors ${
                      resolution === res
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-card text-foreground border-border hover:bg-muted"
                    } disabled:opacity-50`}
                  >
                    {res}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                disabled={diagnostics.isLoading}
                className="w-full px-2 py-1 text-sm bg-card border border-border rounded text-foreground mt-2 disabled:opacity-50"
                placeholder="1920x1080"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Keyframe Interval (ms)
              </label>
              <input
                type="number"
                value={keyframeInterval}
                onChange={e => setKeyframeInterval(e.target.value)}
                disabled={diagnostics.isLoading}
                className="w-full px-2 py-1 text-sm bg-card border border-border rounded text-foreground disabled:opacity-50"
                placeholder="2000"
                min="1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Typically 2000ms for 30fps, 1000ms for 60fps
              </p>
            </div>

            <Button
              onClick={handleRunDiagnostics}
              disabled={diagnostics.isLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm"
            >
              {diagnostics.isLoading ? "Running diagnostics..." : "Run Diagnostics"}
            </Button>
          </div>

          {/* Results */}
          {diagnostics.results && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="p-3 bg-muted rounded border border-border">
                <p className="text-sm font-medium text-foreground">{diagnostics.summary}</p>
                {diagnostics.timestamp && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Run {new Date(diagnostics.timestamp).toLocaleTimeString()}
                  </p>
                )}
              </div>

              {/* Health Status */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded border border-border">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm font-semibold text-foreground capitalize">
                    {diagnostics.results.health.status}
                  </p>
                </div>
                <div className="p-2 rounded border border-border">
                  <p className="text-xs text-muted-foreground">Confidence</p>
                  <p className="text-sm font-semibold text-foreground">
                    {Math.round(diagnostics.results.health.confidence * 100)}%
                  </p>
                </div>
              </div>

              {/* Detailed Metrics */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-foreground">Metrics:</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-muted rounded">
                    <span className="text-muted-foreground">Bitrate:</span>
                    <p className="font-semibold text-foreground">
                      {diagnostics.results.bitrate.actual} kbps
                      <span className="text-muted-foreground ml-1">
                        ({diagnostics.results.bitrate.stability})
                      </span>
                    </p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <span className="text-muted-foreground">Frame Drop:</span>
                    <p className="font-semibold text-foreground">
                      {diagnostics.results.frames.dropRate.toFixed(2)}%
                    </p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <span className="text-muted-foreground">Latency:</span>
                    <p className="font-semibold text-foreground">
                      {diagnostics.results.networkQuality.latency}ms
                    </p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <span className="text-muted-foreground">Keyframes:</span>
                    <p className="font-semibold text-foreground">
                      {diagnostics.results.keyframes.compliant ? "✓ OK" : "✗ Mismatch"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Guidance */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-foreground">Recommendations:</div>
                {diagnostics.guidance.map((item, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded border flex gap-2 ${getSeverityBg(item.severity)}`}
                  >
                    {getSeverityIcon(item.severity)}
                    <p className="text-xs text-foreground">{item.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error State */}
          {diagnostics.error && !diagnostics.results && (
            <div className="p-3 rounded border border-red-200 bg-red-50">
              <p className="text-xs font-medium text-red-900">{diagnostics.error}</p>
              <p className="text-xs text-red-700 mt-1">
                You can still proceed to go live, but your setup may have issues.
              </p>
            </div>
          )}

          {/* Info Message */}
          <div className="p-2 rounded bg-blue-50 border border-blue-200">
            <p className="text-xs text-blue-900">
              💡 <strong>Tip:</strong> Diagnostics never prevent you from going live. They're
              here to help optimize your stream quality.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
