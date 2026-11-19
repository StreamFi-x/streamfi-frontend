"use client";

import { useEffect, useRef, useState } from "react";

export type LiveHealthStatus = "good" | "degraded" | "unavailable";
export type AlertLevel = "none" | "warning" | "critical";
export type LiveCause = "encoder" | "upload" | "mux-side" | "unknown";

export interface LiveStreamHealthReading {
  isActive: boolean;
  status: string;
  reconnectWindow: number | null | undefined;
  fetchedAt: number; // unix ms
  error?: string;
}

export interface UseLiveStreamHealthReturn {
  healthStatus: LiveHealthStatus;
  alertLevel: AlertLevel;
  likelyCause: LiveCause;
  isDataAvailable: boolean;
  lastCheckedAt: Date | null;
  readings: LiveStreamHealthReading[];
}

interface MuxHealthResponse {
  streamId?: string;
  isActive?: boolean;
  status?: string;
  reconnectWindow?: number | null;
  latencyMode?: string;
  recentAssetId?: string | null;
  createdAt?: string | null;
  error?: string;
  detail?: string;
}

const POLL_INTERVAL_MS = 15_000; // 15 seconds
const BUFFER_SIZE = 3; // Circular buffer of 3 readings (45 seconds total)
const CONSECUTIVE_FAILURE_THRESHOLD = 3;

/**
 * Real-time stream health monitoring hook.
 * 
 * Polls `/api/streams/health?streamId={streamId}` at 15-second intervals when
 * the stream is live, maintaining a circular buffer of the last 3 readings.
 * 
 * Returns:
 * - healthStatus: 'good' | 'degraded' | 'unavailable'
 * - alertLevel: 'none' | 'warning' | 'critical'
 * - likelyCause: Heuristic attribution of degradation
 * - readings: Circular buffer of last 3 health checks
 * - lastCheckedAt: Timestamp of last successful poll
 * - isDataAvailable: False after 3 consecutive fetch failures
 */
export function useLiveStreamHealth(
  streamId: string | null | undefined,
  isLive: boolean
): UseLiveStreamHealthReturn {
  const [readings, setReadings] = useState<LiveStreamHealthReading[]>([]);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [isDataAvailable, setIsDataAvailable] = useState(false);
  const [alertLevel, setAlertLevel] = useState<AlertLevel>("none");
  const [healthStatus, setHealthStatus] = useState<LiveHealthStatus>(
    "unavailable"
  );
  const [likelyCause, setLikelyCause] = useState<LiveCause>("unknown");

  const consecutiveFailures = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to compute alert level and health status from readings
  const updateHealthStatus = (
    currentReadings: LiveStreamHealthReading[],
    dataAvailable: boolean
  ) => {
    if (!dataAvailable) {
      setHealthStatus("unavailable");
      setAlertLevel("none");
      return;
    }

    // Count "bad" readings: when status is not 'active' or reconnectWindow is very low
    let badCount = 0;
    for (const reading of currentReadings) {
      if (!reading.isActive || (reading.reconnectWindow != null && reading.reconnectWindow <= 10)) {
        badCount++;
      }
    }

    // Determine alert level
    let newAlertLevel: AlertLevel = "none";
    if (badCount >= 3) {
      newAlertLevel = "critical";
    } else if (badCount >= 2) {
      newAlertLevel = "warning";
    }

    // Determine health status
    const newHealthStatus: LiveHealthStatus =
      newAlertLevel === "none" ? "good" : "degraded";

    setAlertLevel(newAlertLevel);
    setHealthStatus(newHealthStatus);
  };

  // Helper function to determine likely cause
  const computeLikelyCause = (reading: LiveStreamHealthReading): LiveCause => {
    // Mux-side issues: idle, not_found, or fetch error
    if (
      reading.status === "idle" ||
      reading.status === "not_found" ||
      reading.error?.includes("404") ||
      reading.error?.includes("503")
    ) {
      return "mux-side";
    }

    // Encoder issues: active but reconnectWindow is very low (encoder just reconnected)
    if (
      reading.isActive &&
      reading.reconnectWindow != null &&
      reading.reconnectWindow <= 10
    ) {
      return "encoder";
    }

    // Upload/network issues: not active for other reasons
    if (!reading.isActive) {
      return "upload";
    }

    return "unknown";
  };

  // Fetch health data
  const fetchHealth = async () => {
    if (!streamId || !isLive) {
      return;
    }

    try {
      const response = await fetch(
        `/api/streams/health?streamId=${encodeURIComponent(streamId)}`
      );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data: MuxHealthResponse = await response.json();

      // Reset consecutive failure count on success
      consecutiveFailures.current = 0;

      const newReading: LiveStreamHealthReading = {
        isActive: data.isActive ?? false,
        status: data.status ?? "unknown",
        reconnectWindow: data.reconnectWindow ?? null,
        fetchedAt: Date.now(),
      };

      setReadings(prev => {
        // Circular buffer: keep only last BUFFER_SIZE readings
        const updated = [...prev, newReading];
        if (updated.length > BUFFER_SIZE) {
          updated.shift();
        }
        return updated;
      });

      setLastCheckedAt(new Date());
      setIsDataAvailable(true);

      // Update health status immediately
      setReadings(prev => {
        const updated = [...prev, newReading];
        if (updated.length > BUFFER_SIZE) {
          updated.shift();
        }
        updateHealthStatus(updated, true);
        return updated;
      });
    } catch (error) {
      // Increment consecutive failure count
      consecutiveFailures.current++;

      if (consecutiveFailures.current >= CONSECUTIVE_FAILURE_THRESHOLD) {
        setIsDataAvailable(false);
        setHealthStatus("unavailable");
        setAlertLevel("none");
      }

      console.warn(
        `[useLiveStreamHealth] Fetch failed (attempt ${consecutiveFailures.current}):`,
        error
      );
    }
  };

  // Start polling on mount and when isLive/streamId changes
  useEffect(() => {
    // Do an immediate first poll
    if (isLive && streamId) {
      fetchHealth();
    } else {
      // Reset state when stream goes offline
      setReadings([]);
      setLastCheckedAt(null);
      setIsDataAvailable(false);
      setAlertLevel("none");
      setHealthStatus("unavailable");
      setLikelyCause("unknown");
      consecutiveFailures.current = 0;
    }

    // Set up polling interval
    if (isLive && streamId && !intervalRef.current) {
      intervalRef.current = setInterval(() => {
        fetchHealth();
      }, POLL_INTERVAL_MS);
    }

    // Cleanup interval on unmount or when stream goes offline
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isLive, streamId]);

  // Update likelyCause when readings change
  useEffect(() => {
    if (readings.length > 0) {
      const mostRecentReading = readings[readings.length - 1];
      setLikelyCause(computeLikelyCause(mostRecentReading));
    } else {
      setLikelyCause("unknown");
    }
  }, [readings]);

  return {
    healthStatus,
    alertLevel,
    likelyCause,
    isDataAvailable,
    lastCheckedAt,
    readings,
  };
}
