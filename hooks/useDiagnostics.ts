"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { DiagnosticResults, GuidanceItem, EncoderSettings, DiagnosticResponse } from "@/lib/diagnostics/types";

interface UseDiagnosticsState {
  results: DiagnosticResults | null;
  guidance: GuidanceItem[];
  summary: string;
  isLoading: boolean;
  error: string | null;
  timestamp: string | null;
}

interface UseDiagnosticsReturn extends UseDiagnosticsState {
  run: (encoderSettings: EncoderSettings) => Promise<void>;
  reset: () => void;
}

// Cache key format: `diagnostics:${bitrate}:${resolution}:${keyframe}`
function getCacheKey(encoderSettings: EncoderSettings): string {
  return `diagnostics:${encoderSettings.bitrate}:${encoderSettings.resolution}:${encoderSettings.keyframeIntervalMs}`;
}

// In-memory cache for diagnostic results (5 minute TTL)
const diagnosticsCache = new Map<string, { data: DiagnosticResponse; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function useDiagnostics(): UseDiagnosticsReturn {
  const [results, setResults] = useState<DiagnosticResults | null>(null);
  const [guidance, setGuidance] = useState<GuidanceItem[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);
  const [currentSettings, setCurrentSettings] = useState<EncoderSettings | null>(null);

  const run = useCallback(async (encoderSettings: EncoderSettings) => {
    setIsLoading(true);
    setError(null);

    try {
      const cacheKey = getCacheKey(encoderSettings);
      const now = Date.now();

      // Check cache
      const cached = diagnosticsCache.get(cacheKey);
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        const cachedData = cached.data;
        setResults(cachedData.results);
        setGuidance(cachedData.guidance);
        setSummary(cachedData.summary);
        setTimestamp(cachedData.timestamp);
        setCurrentSettings(encoderSettings);
        setIsLoading(false);
        return;
      }

      // Call API
      const response = await fetch("/api/streams/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encoderSettings }),
      });

      if (!response.ok) {
        throw new Error(`Diagnostics API error: ${response.status}`);
      }

      const data: DiagnosticResponse = await response.json();

      if (!data.success) {
        setError(data.summary || "Diagnostics failed");
        setGuidance(data.guidance);
        setSummary(data.summary);
        setResults(null);
      } else {
        setResults(data.results);
        setGuidance(data.guidance);
        setSummary(data.summary);

        // Cache successful results
        diagnosticsCache.set(cacheKey, { data, timestamp: now });
      }

      setTimestamp(data.timestamp);
      setCurrentSettings(encoderSettings);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setError(errorMsg);
      setResults(null);
      setGuidance([
        {
          message: "Failed to run diagnostics. Please try again.",
          severity: "error",
        },
      ]);
      setSummary("Error");
      setTimestamp(new Date().toISOString());
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResults(null);
    setGuidance([]);
    setSummary("");
    setError(null);
    setTimestamp(null);
    setCurrentSettings(null);
  }, []);

  return {
    results,
    guidance,
    summary,
    isLoading,
    error,
    timestamp,
    run,
    reset,
  };
}
